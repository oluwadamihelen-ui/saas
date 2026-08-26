import { prisma } from "./db";
import { getOrCreateWallet, getWalletBalance, getPlatformUserId, recordWalletTransaction, isUniqueConstraintViolation } from "./wallet";
import { consumePromotionalCoins } from "./promotionalCoins";

export type ContentScope = "MOVIE" | "EPISODE" | "SCENE";

export class ContentNotFoundError extends Error {
  constructor() {
    super("We couldn't find that content.");
  }
}
export class ContentNotPaidError extends Error {
  constructor() {
    super("This content is free — there's nothing to unlock.");
  }
}
export class InsufficientCoinsError extends Error {
  constructor(
    public readonly required: number,
    public readonly balance: number,
  ) {
    super(`You need ${required} Doe to unlock this — your balance is ${balance}.`);
  }
}
export class NotContentOwnerError extends Error {
  constructor() {
    super("You don't have access to configure this content.");
  }
}
export class PriceOutOfRangeError extends Error {
  constructor(min: number, max: number) {
    super(`Price must be between ${min} and ${max} Doe.`);
  }
}
export class InvalidMonetizationConfigError extends Error {}
export class RevenueTransactionNotFoundError extends Error {
  constructor() {
    super("We couldn't find that transaction.");
  }
}
export class AlreadyReversedError extends Error {
  constructor() {
    super("This transaction has already been reversed.");
  }
}

interface ResolvedContent {
  scope: ContentScope;
  projectId: string;
  projectTitle: string;
  episodeId: string | null;
  episodeTitle: string | null;
  sceneId: string | null;
  publisherId: string;
  coinPrice: number | null;
  monetizationMode: "FREE" | "PAID";
}

/**
 * Resolves price and publisher SERVER-SIDE, from the database, for every
 * unlock and access check — never from anything the client sends. This is
 * the one place that decision is made, so every caller shares it.
 */
async function resolveContent(scope: ContentScope, contentId: string): Promise<ResolvedContent> {
  if (scope === "MOVIE") {
    const project = await prisma.project.findUnique({ where: { id: contentId } });
    if (!project) throw new ContentNotFoundError();
    return {
      scope,
      projectId: project.id,
      projectTitle: project.title,
      episodeId: null,
      episodeTitle: null,
      sceneId: null,
      publisherId: project.ownerId,
      coinPrice: project.coinPrice,
      monetizationMode: project.monetizationMode,
    };
  }
  if (scope === "EPISODE") {
    const episode = await prisma.episode.findUnique({ where: { id: contentId }, include: { project: true } });
    if (!episode) throw new ContentNotFoundError();
    return {
      scope,
      projectId: episode.projectId,
      projectTitle: episode.project.title,
      episodeId: episode.id,
      episodeTitle: episode.title,
      sceneId: null,
      publisherId: episode.project.ownerId,
      coinPrice: episode.coinPrice,
      monetizationMode: episode.project.monetizationMode,
    };
  }
  const scene = await prisma.scene.findUnique({ where: { id: contentId }, include: { project: true, episode: true } });
  if (!scene) throw new ContentNotFoundError();
  return {
    scope,
    projectId: scene.projectId,
    projectTitle: scene.project.title,
    episodeId: scene.episodeId,
    episodeTitle: scene.episode?.title ?? null,
    sceneId: scene.id,
    publisherId: scene.project.ownerId,
    coinPrice: scene.coinPrice,
    monetizationMode: scene.project.monetizationMode,
  };
}

function findExistingEntitlement(userId: string, content: ResolvedContent) {
  return prisma.contentEntitlement.findFirst({
    where: { userId, projectId: content.projectId, episodeId: content.episodeId, sceneId: content.sceneId, revokedAt: null },
  });
}

export interface ContentAccessResult {
  free: boolean;
  unlocked: boolean;
  price: number | null;
  balance: number;
  isOwner: boolean;
}

/** Read-only access check — what the watch page uses to decide whether to play, or show a price. */
export async function getContentAccess(userId: string | null, scope: ContentScope, contentId: string): Promise<ContentAccessResult> {
  const content = await resolveContent(scope, contentId);
  const isOwner = userId === content.publisherId;

  if (content.monetizationMode === "FREE" || content.coinPrice === null) {
    return { free: true, unlocked: true, price: null, balance: userId ? await getWalletBalance(userId) : 0, isOwner };
  }
  if (!userId) return { free: false, unlocked: false, price: content.coinPrice, balance: 0, isOwner };
  if (isOwner) return { free: false, unlocked: true, price: content.coinPrice, balance: await getWalletBalance(userId), isOwner };

  const [existing, balance] = await Promise.all([findExistingEntitlement(userId, content), getWalletBalance(userId)]);
  return { free: false, unlocked: Boolean(existing), price: content.coinPrice, balance, isOwner };
}

export interface UnlockResult {
  alreadyUnlocked: boolean;
  entitlementId: string;
}

/**
 * The core atomic operation (spec §9-10, §39): check → resolve price
 * server-side → lock the wallet inside one DB transaction → deduct →
 * create the entitlement → split revenue → commit, or roll back
 * everything together. Concurrency safety comes from
 * WalletTransaction.idempotencyKey's DB-level unique constraint, not from
 * the entitlement check alone (see the comment on ContentEntitlement in
 * schema.prisma) — a losing concurrent request's entire transaction
 * aborts on that constraint, so it never touches the wallet balance.
 */
export async function unlockContent(userId: string, scope: ContentScope, contentId: string): Promise<UnlockResult> {
  const content = await resolveContent(scope, contentId);
  if (content.monetizationMode === "FREE" || content.coinPrice === null) throw new ContentNotPaidError();

  const existing = await findExistingEntitlement(userId, content);
  if (existing) return { alreadyUnlocked: true, entitlementId: existing.id };

  // A creator can always watch their own paid content without spending
  // coins — no money moves, so there's nothing to detect or reverse. This
  // is a normal "you own it" allowance, distinct from the self-purchase
  // fraud pattern (spec §31), which is about fabricating REAL paid
  // revenue via accounts the creator secretly controls.
  if (content.publisherId === userId) {
    const entitlement = await prisma.contentEntitlement.create({
      data: { userId, scope, projectId: content.projectId, episodeId: content.episodeId, sceneId: content.sceneId },
    });
    return { alreadyUnlocked: false, entitlementId: entitlement.id };
  }

  const price = content.coinPrice;
  const idempotencyKey = `unlock:${userId}:${scope}:${content.projectId}:${content.episodeId ?? ""}:${content.sceneId ?? ""}`;
  const unlockType = scope === "MOVIE" ? "MOVIE_UNLOCK" : scope === "EPISODE" ? "EPISODE_UNLOCK" : "SCENE_UNLOCK";

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await getOrCreateWallet(userId, tx);
      if (wallet.balance < price) throw new InsufficientCoinsError(price, wallet.balance);

      const settings = await tx.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      // Publisher gets the floor of their share; the platform absorbs the
      // rounding remainder, so viewer debit always exactly equals
      // publisherShare + platformShare (see schema.prisma's note on this).
      const publisherShare = Math.floor((price * settings.publisherRevenueShareBps) / 10000);
      const platformShare = price - publisherShare;

      const entitlement = await tx.contentEntitlement.create({
        data: { userId, scope, projectId: content.projectId, episodeId: content.episodeId, sceneId: content.sceneId },
      });

      const { transaction: unlockTx } = await recordWalletTransaction(tx, {
        userId,
        type: "CONTENT_UNLOCK",
        amount: -price,
        referenceType: "ContentEntitlement",
        referenceId: entitlement.id,
        idempotencyKey,
        metadata: { scope, projectId: content.projectId, episodeId: content.episodeId, sceneId: content.sceneId },
      });
      // Bookkeeping only — Wallet.balance above is already debited the
      // normal way regardless of whether the viewer has any promotional
      // coins; this just tracks how much of any still-active grant this
      // spend used up, so expiration has something accurate to act on.
      await consumePromotionalCoins(tx, userId, price);

      const revenueTx = await tx.revenueTransaction.create({
        data: {
          publisherId: content.publisherId,
          viewerId: userId,
          projectId: content.projectId,
          projectTitle: content.projectTitle,
          episodeId: content.episodeId,
          episodeTitle: content.episodeTitle,
          sceneId: content.sceneId,
          entitlementId: entitlement.id,
          viewerUnlockTransactionId: unlockTx.id,
          unlockType,
          coinAmount: price,
          publisherShareCoins: publisherShare,
          platformShareCoins: platformShare,
        },
      });

      await recordWalletTransaction(tx, {
        userId: content.publisherId,
        type: "CREATOR_REVENUE",
        amount: publisherShare,
        referenceType: "RevenueTransaction",
        referenceId: revenueTx.id,
        idempotencyKey: `creator-revenue:${revenueTx.id}`,
      });

      const platformUserId = await getPlatformUserId(tx);
      await recordWalletTransaction(tx, {
        userId: platformUserId,
        type: "PLATFORM_REVENUE",
        amount: platformShare,
        referenceType: "RevenueTransaction",
        referenceId: revenueTx.id,
        idempotencyKey: `platform-revenue:${revenueTx.id}`,
      });

      await tx.creatorEarning.create({
        data: {
          publisherId: content.publisherId,
          revenueTransactionId: revenueTx.id,
          coins: publisherShare,
          status: "PENDING",
          availableAt: new Date(Date.now() + settings.settlementPeriodDays * 24 * 60 * 60 * 1000),
        },
      });

      return { alreadyUnlocked: false, entitlementId: entitlement.id };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "idempotencyKey")) {
      // Lost the race to a concurrent identical request — it already
      // completed the unlock; this one just reports the same result.
      const winner = await findExistingEntitlement(userId, content);
      if (winner) return { alreadyUnlocked: true, entitlementId: winner.id };
    }
    throw error;
  }
}

/**
 * Reverses a settled content unlock (spec §28-29: refunds/chargebacks) —
 * admin-only. Never deletes or mutates the original ledger rows; creates
 * a full mirror-image reversal (viewer credited back, publisher and
 * platform both debited their share), each new row referencing the
 * original via `reversesId`. The CreatorEarning is marked REVERSED so it
 * can never be paid out, regardless of whether it had already cleared its
 * settlement hold. Revoking the viewer's access is the caller's policy
 * choice (spec: "use the platform's configured refund policy"), not
 * automatic — a routine double-charge refund might leave access in
 * place, while a fraud reversal should take it away.
 */
export async function reverseContentUnlock(revenueTransactionId: string, params: { reason: string; revokeAccess: boolean }): Promise<void> {
  const revenueTx = await prisma.revenueTransaction.findUnique({ where: { id: revenueTransactionId } });
  if (!revenueTx) throw new RevenueTransactionNotFoundError();

  const existingRefund = await prisma.refund.findUnique({ where: { revenueTransactionId } });
  if (existingRefund) throw new AlreadyReversedError();

  // Each leg's original ledger row is only required if that party's
  // account still exists — a deleted viewer or publisher has no wallet
  // left to credit/debit, and their own WalletTransaction history is
  // deleted along with their account (spec's own deleteUserAccount), so
  // it's expected to be gone too. The reversal still proceeds for
  // whichever legs remain reversible, rather than hard-blocking the whole
  // operation because one party is gone.
  const [viewerUnlockTx, creatorRevenueTx, platformRevenueTx] = await Promise.all([
    revenueTx.viewerId ? prisma.walletTransaction.findUnique({ where: { id: revenueTx.viewerUnlockTransactionId } }) : null,
    revenueTx.publisherId ? prisma.walletTransaction.findUnique({ where: { idempotencyKey: `creator-revenue:${revenueTx.id}` } }) : null,
    prisma.walletTransaction.findUnique({ where: { idempotencyKey: `platform-revenue:${revenueTx.id}` } }),
  ]);
  if (revenueTx.viewerId && !viewerUnlockTx) {
    throw new Error(`Viewer's original CONTENT_UNLOCK ledger row for RevenueTransaction ${revenueTx.id} is missing — cannot reverse safely, needs manual review.`);
  }
  if (revenueTx.publisherId && !creatorRevenueTx) {
    throw new Error(`Publisher's original CREATOR_REVENUE ledger row for RevenueTransaction ${revenueTx.id} is missing — cannot reverse safely, needs manual review.`);
  }
  if (!platformRevenueTx) {
    throw new Error(`Platform's original PLATFORM_REVENUE ledger row for RevenueTransaction ${revenueTx.id} is missing — cannot reverse safely, needs manual review.`);
  }

  const platformUserId = await getPlatformUserId();

  await prisma.$transaction(async (tx) => {
    if (revenueTx.viewerId && viewerUnlockTx) {
      await recordWalletTransaction(tx, {
        userId: revenueTx.viewerId,
        type: "REVERSAL",
        amount: revenueTx.coinAmount,
        referenceType: "RevenueTransaction",
        referenceId: revenueTx.id,
        reversesId: viewerUnlockTx.id,
        idempotencyKey: `reversal:viewer:${revenueTx.id}`,
        metadata: { reason: params.reason },
      });
    }
    if (revenueTx.publisherId && creatorRevenueTx) {
      await recordWalletTransaction(tx, {
        userId: revenueTx.publisherId,
        type: "REVERSAL",
        amount: -revenueTx.publisherShareCoins,
        referenceType: "RevenueTransaction",
        referenceId: revenueTx.id,
        reversesId: creatorRevenueTx.id,
        idempotencyKey: `reversal:publisher:${revenueTx.id}`,
        metadata: { reason: params.reason },
      });
    }
    await recordWalletTransaction(tx, {
      userId: platformUserId,
      type: "REVERSAL",
      amount: -revenueTx.platformShareCoins,
      referenceType: "RevenueTransaction",
      referenceId: revenueTx.id,
      reversesId: platformRevenueTx.id,
      idempotencyKey: `reversal:platform:${revenueTx.id}`,
      metadata: { reason: params.reason },
    });

    const earningUpdate = await tx.creatorEarning.updateMany({ where: { revenueTransactionId: revenueTx.id }, data: { status: "REVERSED" } });
    if (earningUpdate.count !== 1) {
      throw new Error(`Expected exactly one CreatorEarning for RevenueTransaction ${revenueTx.id}, updated ${earningUpdate.count}.`);
    }
    await tx.refund.create({
      data: { revenueTransactionId: revenueTx.id, coinsReversed: revenueTx.coinAmount, reason: params.reason, status: "COMPLETED", completedAt: new Date() },
    });
    if (params.revokeAccess && revenueTx.entitlementId) {
      // Mark revoked rather than deleting the entitlement — deleting it
      // would cascade away this very RevenueTransaction/CreatorEarning via
      // ContentEntitlement's onDelete: Cascade relations, destroying the
      // permanent financial record the whole point of this function is to
      // preserve. Found by a real concurrency/reversal test, not assumed.
      // (If entitlementId is already null, the entitlement itself is gone
      // — e.g. the viewer deleted their account — so there's nothing left
      // to revoke.)
      const entitlementRevoke = await tx.contentEntitlement.updateMany({
        where: { id: revenueTx.entitlementId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (entitlementRevoke.count !== 1) {
        throw new Error(`Expected exactly one ContentEntitlement ${revenueTx.entitlementId} to revoke, updated ${entitlementRevoke.count}.`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Creator-facing monetization configuration
// ---------------------------------------------------------------------------

export async function setProjectMonetization(
  userId: string,
  projectId: string,
  params: { mode: "FREE" | "PAID"; scope?: ContentScope; coinPrice?: number },
): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.ownerId !== userId) throw new NotContentOwnerError();

  if (params.mode === "FREE") {
    await prisma.project.update({ where: { id: projectId }, data: { monetizationMode: "FREE", monetizationScope: null, coinPrice: null } });
    return;
  }

  if (!params.scope) throw new InvalidMonetizationConfigError("Choose a charge level: movie, episode, or scene.");
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (params.scope === "MOVIE") {
    if (params.coinPrice === undefined) throw new InvalidMonetizationConfigError("Set a price for the movie.");
    if (params.coinPrice < settings.minMovieCoinPrice || params.coinPrice > settings.maxMovieCoinPrice) {
      throw new PriceOutOfRangeError(settings.minMovieCoinPrice, settings.maxMovieCoinPrice);
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { monetizationMode: "PAID", monetizationScope: "MOVIE", coinPrice: params.coinPrice },
    });
    return;
  }

  // EPISODE/SCENE: the project just records its scope here; individual
  // episode/scene prices are set separately below, since there are many.
  await prisma.project.update({
    where: { id: projectId },
    data: { monetizationMode: "PAID", monetizationScope: params.scope, coinPrice: null },
  });
}

export async function setEpisodePrice(userId: string, episodeId: string, coinPrice: number): Promise<void> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId }, include: { project: true } });
  if (episode.project.ownerId !== userId) throw new NotContentOwnerError();
  if (episode.project.monetizationScope !== "EPISODE") {
    throw new InvalidMonetizationConfigError("This project isn't configured for per-episode pricing.");
  }
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  if (coinPrice < settings.minEpisodeCoinPrice || coinPrice > settings.maxEpisodeCoinPrice) {
    throw new PriceOutOfRangeError(settings.minEpisodeCoinPrice, settings.maxEpisodeCoinPrice);
  }
  await prisma.episode.update({ where: { id: episodeId }, data: { coinPrice } });
}

export async function setScenePrice(userId: string, sceneId: string, coinPrice: number): Promise<void> {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId }, include: { project: true } });
  if (scene.project.ownerId !== userId) throw new NotContentOwnerError();
  if (scene.project.monetizationScope !== "SCENE") {
    throw new InvalidMonetizationConfigError("This project isn't configured for per-scene pricing.");
  }
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  if (coinPrice < settings.minSceneCoinPrice || coinPrice > settings.maxSceneCoinPrice) {
    throw new PriceOutOfRangeError(settings.minSceneCoinPrice, settings.maxSceneCoinPrice);
  }
  await prisma.scene.update({ where: { id: sceneId }, data: { coinPrice } });
}

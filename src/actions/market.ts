"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/validation";
import { addScreenshot, attachEvidence, createListing, detachEvidence, ensureCreator, removeScreenshot, submitForReview, updateListing } from "@/lib/market/listings";
import { markTradingViewGranted, setTradingViewUsername, startPurchase } from "@/lib/market/orders";
import { reportContent, submitReview } from "@/lib/market/reviews";
import { requestPayout, setPayoutMethod } from "@/lib/market/creator";
import { runLicensedBacktest } from "@/lib/market/access";

const err = (error: string): ActionState => ({ error });
const back = (path: string, kind: "error" | "ok", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

// ------------------------------------------------------------------ creator

export async function saveCreatorProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await ensureCreator(user.id, { displayName: String(fd.get("displayName") ?? ""), bio: String(fd.get("bio") ?? ""), website: String(fd.get("website") ?? "") });
  if (!r.ok) return err(r.error);
  revalidatePath("/creator");
  const next = String(fd.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return { ok: true, message: "Profile saved." };
}

export async function createListingAction(fd: FormData) {
  const user = await getUser();
  const indicatorId = String(fd.get("indicatorId") ?? "");
  if (!(await prisma.creator.findUnique({ where: { userId: user.id }, select: { id: true } }))) redirect(`/creator/profile?next=${encodeURIComponent(`/lab/indicators/${indicatorId}`)}`);
  const r = await createListing(user.id, indicatorId);
  if (!r.ok) back(`/lab/indicators/${indicatorId}`, "error", r.error);
  else redirect(`/creator/listings/${r.id}`);
}

export async function updateListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const num = Number(fd.get("priceUsd") ?? 0);
  const r = await updateListing(user.id, String(fd.get("id")), {
    title: String(fd.get("title") ?? ""), tagline: String(fd.get("tagline") ?? ""), description: String(fd.get("description") ?? ""),
    categories: fd.getAll("categories").map(String), features: String(fd.get("features") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    documentation: String(fd.get("documentation") ?? ""), methodology: String(fd.get("methodology") ?? ""), dataSourceNote: String(fd.get("dataSourceNote") ?? ""),
    demoVideoUrl: String(fd.get("demoVideoUrl") ?? "").trim() || null, pricingModel: String(fd.get("pricingModel") ?? "FREE"), priceUsd: Number.isFinite(num) ? num : 0,
    sourceIncluded: fd.get("sourceIncluded") === "on", updatePolicy: String(fd.get("updatePolicy") ?? "SAME_MAJOR"), tradingViewAccess: fd.get("tradingViewAccess") === "on",
    allowBuyerBacktest: fd.get("allowBuyerBacktest") === "on", strategyId: String(fd.get("strategyId") ?? "") || null,
  });
  if (!r.ok) return err(r.error);
  revalidatePath(`/creator/listings/${fd.get("id")}`);
  return { ok: true, message: "Saved." };
}

export async function uploadScreenshotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`shot:${user.id}`, 20, 10 * 60_000).ok) return err("Too many uploads. Try again shortly.");
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return err("Choose an image.");
  const r = await addScreenshot(user.id, String(fd.get("id")), { name: file.name, size: file.size, data: Buffer.from(await file.arrayBuffer()) }, String(fd.get("caption") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath(`/creator/listings/${fd.get("id")}`);
  return { ok: true, message: "Screenshot added." };
}

export async function removeScreenshotAction(fd: FormData) {
  const user = await getUser();
  await removeScreenshot(user.id, String(fd.get("mediaId")));
  revalidatePath(`/creator/listings/${fd.get("id")}`);
}

export async function attachEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await attachEvidence(user.id, String(fd.get("id")), String(fd.get("runId")), String(fd.get("note") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath(`/creator/listings/${fd.get("id")}`);
  return { ok: true, message: "Backtest attached. Everyone will see all of its assumptions." };
}

export async function detachEvidenceAction(fd: FormData) {
  const user = await getUser();
  await detachEvidence(user.id, String(fd.get("id")), String(fd.get("runId")));
  revalidatePath(`/creator/listings/${fd.get("id")}`);
}

export async function submitListingAction(fd: FormData) {
  const user = await getUser();
  const id = String(fd.get("id"));
  const r = await submitForReview(user.id, id);
  revalidatePath(`/creator/listings/${id}`);
  if (!r.ok) back(`/creator/listings/${id}`, "error", r.error);
  else back(`/creator/listings/${id}`, "ok", "Submitted for review. We'll check the listing against the marketplace rules.");
}

export async function setPayoutMethodAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await setPayoutMethod(user.id, String(fd.get("method") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath("/creator");
  return { ok: true, message: "Saved. An admin will verify your payout details." };
}

export async function requestPayoutAction(fd: FormData) {
  const user = await getUser();
  void fd;
  const r = await requestPayout(user.id);
  revalidatePath("/creator");
  if (!r.ok) back("/creator", "error", r.error);
  else back("/creator", "ok", `Payout of $${(r.amountUsdCents / 100).toFixed(2)} requested.`);
}

export async function markTvGrantedAction(fd: FormData) {
  const user = await getUser();
  await markTradingViewGranted(user.id, String(fd.get("licenseId")));
  revalidatePath("/creator");
}

// ------------------------------------------------------------------ buyer

export async function purchaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser(); // redirects to /login when signed out
  if (!rateLimit(`purchase:${user.id}`, 10, 10 * 60_000).ok) return err("Too many attempts. Try again shortly.");
  const r = await startPurchase({
    buyerId: user.id, buyerEmail: user.email, listingId: String(fd.get("listingId")), currency: fd.get("currency") === "NGN" ? "NGN" : "USD",
    tradingViewUsername: String(fd.get("tradingViewUsername") ?? ""), appUrl: process.env.APP_URL ?? "http://localhost:3000",
  });
  if (!r.ok) return err(r.error);
  if (r.kind === "granted") { revalidatePath("/library"); redirect("/library?ok=" + encodeURIComponent("Added to My Indicators.")); }
  redirect(r.url);
}

export async function submitReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await submitReview(user.id, String(fd.get("listingId")), { rating: Number(fd.get("rating")), title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? "") });
  if (!r.ok) return err(r.error);
  revalidatePath("/market", "layout");
  return { ok: true, message: "Thanks — your review is live." };
}

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await reportContent(user.id, { listingId: String(fd.get("listingId") ?? "") || undefined, reviewId: String(fd.get("reviewId") ?? "") || undefined, reason: String(fd.get("reason") ?? ""), details: String(fd.get("details") ?? "") });
  if (!r.ok) return err(r.error);
  return { ok: true, message: "Report sent to our moderators." };
}

export async function setTvUsernameAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await setTradingViewUsername(user.id, String(fd.get("listingId")), String(fd.get("username") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath("/library");
  return { ok: true, message: "Saved. The creator will grant access on TradingView." };
}

export async function licensedBacktestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`labrun:${user.id}`, 20, 60_000).ok) return err("Slow down — too many tests in a minute.");
  const n = (k: string, d: number) => { const v = fd.get(k); return v === null || v === "" ? d : Number(v); };
  const r = await runLicensedBacktest(user.id, String(fd.get("listingId")), {
    datasetId: String(fd.get("datasetId") ?? ""), fromDate: String(fd.get("fromDate") ?? "") || undefined, toDate: String(fd.get("toDate") ?? "") || undefined,
    initialBalance: n("initialBalance", 10_000), riskPercent: n("riskPercent", 1), spread: n("spread", 0), slippage: n("slippage", 0), commissionPerLot: n("commissionPerLot", 0), pipSize: n("pipSize", 0) || undefined,
  });
  if (!r.ok) return err(r.error);
  redirect(`/lab/runs/${r.runId}`);
}

import "dotenv/config";
import { PrismaClient, Prisma } from "../../src/generated/prisma/client";

// Standalone script (see backfill-permissions.ts for why: the real
// createPartnerCommissionForInvoice/createPartnerCommissionForBuyerInvoice
// in src/lib/services/partner-commissions.ts both start with
// `import "server-only"`, which throws outside Next's server bundle — so
// this reimplements their exact same rules inline instead of importing them).
//
// Fixes a real gap: markPlatformInvoicePaid and markBuyerInvoicePaid (the
// Super Admin's manual "mark as paid" for an offline payment) never called
// the commission engine — only the online Paystack confirm path did. Any
// invoice on a Partner-linked agreement that was marked paid manually
// instead of through the online flow has a missing commission. That call is
// now added to both functions (see git history), which fixes it going
// forward; this script finds and creates the ones that already fell through
// the gap before that fix shipped.
//
// Defaults to a DRY RUN — prints exactly what it would create and changes
// nothing. Pass --apply to actually write the missing PartnerCommission rows.
//
// Pass --buyer-email=<email> to scope the run to a single Buyer's invoices
// only (case-insensitive match against the Buyer's linked User.email) and
// skip the school-side PlatformInvoice scan entirely — useful for fixing
// one reported case without touching anything else in production.
//
// Run with:
//   npx tsx --tsconfig tsconfig.json prisma/scripts/backfill-missing-partner-commissions.ts
//   npx tsx --tsconfig tsconfig.json prisma/scripts/backfill-missing-partner-commissions.ts --apply
//   npx tsx --tsconfig tsconfig.json prisma/scripts/backfill-missing-partner-commissions.ts --buyer-email=someone@example.com
//   npx tsx --tsconfig tsconfig.json prisma/scripts/backfill-missing-partner-commissions.ts --buyer-email=someone@example.com --apply

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BUYER_EMAIL_ARG = process.argv.find((a) => a.startsWith("--buyer-email="));
const BUYER_EMAIL = BUYER_EMAIL_ARG ? BUYER_EMAIL_ARG.slice("--buyer-email=".length).trim().toLowerCase() : null;

function money(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toLocaleString()} ${currency}`;
}

async function main() {
  console.log(APPLY ? "Applying — this will create real PartnerCommission rows.\n" : "Dry run — nothing will be written. Pass --apply to actually create rows.\n");

  const config = await prisma.partnerCommissionConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    console.error("No PartnerCommissionConfig row exists yet — nothing to backfill against.");
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  // --- School-side: PlatformInvoice on a Partner-linked CommercialAgreement ---
  const platformInvoices = BUYER_EMAIL
    ? []
    : await prisma.platformInvoice.findMany({
        where: { status: "PAID", commercialAgreement: { partnerId: { not: null } } },
        include: { commercialAgreement: true, school: true, partnerCommission: true },
      });

  for (const invoice of platformInvoices) {
    const agreement = invoice.commercialAgreement!;
    if (invoice.partnerCommission) { skipped++; continue; } // already has one
    if (agreement.commissionEndDate && invoice.paidAt && invoice.paidAt > agreement.commissionEndDate) {
      console.log(`  SKIP  platform invoice ${invoice.id} (${invoice.school?.name ?? "?"}) — past commissionEndDate`);
      skipped++;
      continue;
    }
    if (agreement.commissionPolicy === "FIRST_PAYMENT_ONLY") {
      const alreadyEarned = await prisma.partnerCommission.findFirst({ where: { commercialAgreementId: agreement.id }, select: { id: true } });
      if (alreadyEarned) { skipped++; continue; }
    }

    const commissionAmountMinor = Math.round((invoice.amountMinor * agreement.commissionRateBps) / 10000);
    const earnedAt = invoice.paidAt ?? invoice.createdAt;
    const availableAt = new Date(earnedAt);
    availableAt.setDate(availableAt.getDate() + config.holdDays);

    console.log(
      `  CREATE platform invoice ${invoice.id} (${invoice.school?.name ?? "?"}) -> partner ${agreement.partnerId}: ${money(commissionAmountMinor, invoice.currency)}`
    );

    if (APPLY) {
      try {
        const commission = await prisma.partnerCommission.create({
          data: {
            partnerId: agreement.partnerId!,
            schoolId: invoice.schoolId,
            commercialAgreementId: agreement.id,
            platformInvoiceId: invoice.id,
            commercialMode: agreement.commercialMode,
            commissionRateBps: agreement.commissionRateBps,
            eligibleAmountMinor: invoice.amountMinor,
            commissionAmountMinor,
            currency: invoice.currency,
            earnedAt,
            availableAt,
          },
        });
        await prisma.auditLog.create({
          data: {
            schoolId: invoice.schoolId,
            action: "partner_commission.backfilled",
            resourceType: "PartnerCommission",
            resourceId: commission.id,
            newValue: { partnerId: agreement.partnerId, commercialAgreementId: agreement.id, platformInvoiceId: invoice.id, commissionAmountMinor },
          },
        });
        created++;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          console.log(`    (already exists, skipping — created by a concurrent run or the online path)`);
          skipped++;
        } else {
          throw error;
        }
      }
    } else {
      created++;
    }
  }

  // --- Buyer-side: BuyerInvoice on a Partner-linked BuyerAgreement ---
  const buyerInvoices = await prisma.buyerInvoice.findMany({
    where: {
      status: "PAID",
      buyerAgreement: { partnerId: { not: null } },
      ...(BUYER_EMAIL ? { buyer: { user: { email: { equals: BUYER_EMAIL, mode: "insensitive" } } } } : {}),
    },
    include: { buyerAgreement: { include: { partner: true } }, buyer: { include: { user: { select: { email: true } } } }, partnerCommission: true },
  });

  if (BUYER_EMAIL) {
    console.log(`Scoped to buyer email: ${BUYER_EMAIL} (${buyerInvoices.length} PAID invoice(s) found on Partner-linked agreements)\n`);
    for (const invoice of buyerInvoices) {
      console.log(`  invoice ${invoice.id} -> agreement ${invoice.buyerAgreement.id} -> partner ${invoice.buyerAgreement.partner?.displayName ?? invoice.buyerAgreement.partnerId} (${invoice.buyerAgreement.partner?.partnerCode ?? "?"})`);
    }
    console.log();
  }

  for (const invoice of buyerInvoices) {
    const agreement = invoice.buyerAgreement;
    if (invoice.partnerCommission) { skipped++; continue; }
    if (agreement.commissionEndDate && invoice.paidAt && invoice.paidAt > agreement.commissionEndDate) {
      console.log(`  SKIP  buyer invoice ${invoice.id} (${invoice.buyer?.displayName ?? invoice.buyer?.user?.email ?? "?"}) — past commissionEndDate`);
      skipped++;
      continue;
    }
    if (agreement.commissionPolicy === "FIRST_PAYMENT_ONLY") {
      const alreadyEarned = await prisma.partnerCommission.findFirst({ where: { buyerAgreementId: agreement.id }, select: { id: true } });
      if (alreadyEarned) { skipped++; continue; }
    }

    const commissionAmountMinor = Math.round((invoice.amountMinor * agreement.commissionRateBps) / 10000);
    const earnedAt = invoice.paidAt ?? invoice.createdAt;
    const availableAt = new Date(earnedAt);
    availableAt.setDate(availableAt.getDate() + config.holdDays);

    console.log(
      `  CREATE buyer invoice ${invoice.id} (${invoice.buyer?.displayName ?? invoice.buyer?.user?.email ?? "?"}) -> partner ${agreement.partnerId}: ${money(commissionAmountMinor, invoice.currency)}`
    );

    if (APPLY) {
      try {
        const commission = await prisma.partnerCommission.create({
          data: {
            partnerId: agreement.partnerId!,
            buyerId: invoice.buyerId,
            buyerAgreementId: agreement.id,
            buyerInvoiceId: invoice.id,
            commercialMode: "BUY",
            commissionRateBps: agreement.commissionRateBps,
            eligibleAmountMinor: invoice.amountMinor,
            commissionAmountMinor,
            currency: invoice.currency,
            earnedAt,
            availableAt,
          },
        });
        await prisma.auditLog.create({
          data: {
            action: "partner_commission.backfilled",
            resourceType: "PartnerCommission",
            resourceId: commission.id,
            newValue: { partnerId: agreement.partnerId, buyerAgreementId: agreement.id, buyerInvoiceId: invoice.id, commissionAmountMinor },
          },
        });
        created++;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          console.log(`    (already exists, skipping — created by a concurrent run or the online path)`);
          skipped++;
        } else {
          throw error;
        }
      }
    } else {
      created++;
    }
  }

  console.log(`\n${APPLY ? "Created" : "Would create"} ${created} commission(s); ${skipped} invoice(s) already had one or didn't qualify.`);
  if (!APPLY && created > 0) {
    console.log("Re-run with --apply to actually create these.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

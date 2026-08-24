import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getAvailablePayoutBalance } from "@/lib/payouts";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { ConnectPayoutAccountForm } from "@/components/earnings/ConnectPayoutAccountForm";
import { WithdrawButton } from "@/components/earnings/WithdrawButton";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AVAILABLE: "Available",
  PAID: "Paid out",
  REVERSED: "Reversed",
  DISPUTED: "Disputed",
};

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
};

export default async function EarningsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const availableProviders: ("PAYSTACK" | "KORAPAY")[] = [
    ...(env.PAYSTACK_SECRET_KEY ? (["PAYSTACK"] as const) : []),
    ...(env.KORAPAY_SECRET_KEY ? (["KORAPAY"] as const) : []),
  ];

  const [earnings, revenueTransactions, payoutAccount, payoutBalance, payouts, settings] = await Promise.all([
    prisma.creatorEarning.findMany({ where: { publisherId: userId } }),
    // Uses the projectTitle/episodeTitle snapshots taken at unlock time,
    // not a live join — this stays legible even after the project or
    // publisher account is later deleted (see schema.prisma's note on
    // RevenueTransaction).
    prisma.revenueTransaction.findMany({
      where: { publisherId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payoutAccount.findUnique({ where: { userId } }),
    getAvailablePayoutBalance(userId),
    prisma.payout.findMany({ where: { publisherId: userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);

  // A worker job transitions CreatorEarning PENDING -> AVAILABLE hourly
  // once the settlement hold (availableAt) elapses — this is a display-side
  // fallback only, covering the up-to-an-hour lag between availableAt
  // passing and the next job run, not a substitute for the real transition.
  const isEffectivelyAvailable = (e: (typeof earnings)[number]) => e.status === "AVAILABLE" || (e.status === "PENDING" && e.availableAt <= now);

  const available = earnings.filter(isEffectivelyAvailable).reduce((sum, e) => sum + e.coins, 0);
  const pending = earnings.filter((e) => e.status === "PENDING" && e.availableAt > now).reduce((sum, e) => sum + e.coins, 0);
  const lifetime = earnings.filter((e) => e.status !== "REVERSED").reduce((sum, e) => sum + e.coins, 0);
  const thisMonth = earnings.filter((e) => e.status !== "REVERSED" && e.createdAt >= monthStart).reduce((sum, e) => sum + e.coins, 0);
  const paidUnlocks = revenueTransactions.length;
  const coinRevenue = revenueTransactions.reduce((sum, tx) => sum + tx.coinAmount, 0);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Earnings</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Your share of coin-gated unlocks on your published movies.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">Available</p>
              <p className="mt-1 font-display text-2xl font-bold text-cinerra-text">🪙 {available.toLocaleString()}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">Pending</p>
              <p className="mt-1 font-display text-2xl font-bold text-cinerra-text">🪙 {pending.toLocaleString()}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">Lifetime</p>
              <p className="mt-1 font-display text-2xl font-bold text-cinerra-text">🪙 {lifetime.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">This Month</p>
              <p className="mt-1 text-lg font-semibold text-cinerra-text">🪙 {thisMonth.toLocaleString()}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">Paid Unlocks</p>
              <p className="mt-1 text-lg font-semibold text-cinerra-text">{paidUnlocks.toLocaleString()}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-cinerra-muted">Coin Revenue</p>
              <p className="mt-1 text-lg font-semibold text-cinerra-text">🪙 {coinRevenue.toLocaleString()}</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Payouts</h2>
            {availableProviders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cinerra-border/80 bg-cinerra-surface/30 px-4 py-6 text-center text-sm text-cinerra-muted">
                Payouts aren&rsquo;t configured on this server yet.
              </p>
            ) : (
              <div className="space-y-4">
                {payoutAccount ? (
                  <div className="card flex items-center justify-between text-sm">
                    <div>
                      <p className="text-cinerra-text">
                        {payoutAccount.provider === "PAYSTACK" ? "Paystack" : "Korapay"} · {payoutAccount.accountName}
                      </p>
                      <p className="text-xs text-cinerra-muted">
                        {payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ConnectPayoutAccountForm availableProviders={availableProviders} />
                )}

                <div className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-cinerra-muted">Available to withdraw</p>
                    <p className="mt-1 font-display text-xl font-bold text-cinerra-text">
                      🪙 {payoutBalance.coins.toLocaleString()}
                      <span className="ml-2 text-sm font-normal text-cinerra-muted">
                        (~{(payoutBalance.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: settings.payoutCurrency })})
                      </span>
                    </p>
                    {payoutBalance.coins < settings.payoutMinimumCoins && (
                      <p className="mt-1 text-xs text-cinerra-muted">Minimum withdrawal is {settings.payoutMinimumCoins.toLocaleString()} Coins.</p>
                    )}
                  </div>
                  <WithdrawButton disabled={!payoutAccount || payoutBalance.coins < settings.payoutMinimumCoins} />
                </div>

                {payouts.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-cinerra-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-cinerra-surface text-xs uppercase text-cinerra-muted">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Coins</th>
                          <th className="px-4 py-2">Amount</th>
                          <th className="px-4 py-2">Provider</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cinerra-border">
                        {payouts.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2 text-cinerra-muted">{p.createdAt.toLocaleDateString()}</td>
                            <td className="px-4 py-2">🪙 {p.coins.toLocaleString()}</td>
                            <td className="px-4 py-2">{(p.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: p.currency })}</td>
                            <td className="px-4 py-2 text-cinerra-muted">{p.provider === "PAYSTACK" ? "Paystack" : "Korapay"}</td>
                            <td className="px-4 py-2 text-cinerra-muted" title={p.failureReason ?? undefined}>
                              {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Transaction History</h2>
            {revenueTransactions.length === 0 ? (
              <p className="text-sm text-cinerra-muted">No unlocks yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-cinerra-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cinerra-surface text-xs uppercase text-cinerra-muted">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Movie</th>
                      <th className="px-4 py-2">Episode</th>
                      <th className="px-4 py-2">Coins Spent</th>
                      <th className="px-4 py-2">Your Share</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cinerra-border">
                    {revenueTransactions.map((tx) => {
                      const earning = earnings.find((e) => e.revenueTransactionId === tx.id);
                      return (
                        <tr key={tx.id}>
                          <td className="px-4 py-2 text-cinerra-muted">{tx.createdAt.toLocaleDateString()}</td>
                          <td className="px-4 py-2">{tx.projectTitle}</td>
                          <td className="px-4 py-2 text-cinerra-muted">{tx.episodeTitle ?? "—"}</td>
                          <td className="px-4 py-2">🪙 {tx.coinAmount.toLocaleString()}</td>
                          <td className="px-4 py-2">🪙 {tx.publisherShareCoins.toLocaleString()}</td>
                          <td className="px-4 py-2 text-cinerra-muted">{earning ? (STATUS_LABEL[earning.status] ?? earning.status) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

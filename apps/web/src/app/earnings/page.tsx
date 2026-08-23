import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AVAILABLE: "Available",
  PAID: "Paid out",
  REVERSED: "Reversed",
  DISPUTED: "Disputed",
};

export default async function EarningsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [earnings, revenueTransactions] = await Promise.all([
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
  ]);

  // The settlement hold is time-based (availableAt), but nothing yet
  // transitions CreatorEarning.status from PENDING to AVAILABLE once it
  // elapses — that needs a scheduled job (a natural fit for the existing
  // worker), not built in this phase. Computed here for display instead
  // of trusting the stored status, so the numbers are still honest today.
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

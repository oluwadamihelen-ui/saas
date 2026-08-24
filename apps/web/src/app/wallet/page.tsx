import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { env } from "@/lib/env";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { BuyCoinsGrid } from "@/components/wallet/BuyCoinsGrid";

const TRANSACTION_LABELS: Record<string, string> = {
  COIN_PURCHASE: "Bought Coins",
  CONTENT_UNLOCK: "Unlocked content",
  CREATOR_REVENUE: "Earnings from a viewer unlock",
  PLATFORM_REVENUE: "Platform revenue",
  REFUND: "Refund",
  REVERSAL: "Reversal",
  PAYOUT: "Payout",
  ADJUSTMENT: "Adjustment",
  PROMOTIONAL_CREDIT: "Promotional credit",
};

export default async function WalletPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const availableProviders: ("PAYSTACK" | "KORAPAY")[] = [
    ...(env.PAYSTACK_SECRET_KEY ? (["PAYSTACK"] as const) : []),
    ...(env.KORAPAY_SECRET_KEY ? (["KORAPAY"] as const) : []),
  ];

  const [balance, packages, recentActivity] = await Promise.all([
    getWalletBalance(userId),
    prisma.coinPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Coin Wallet</h1>

          {searchParams.checkout === "success" && (
            <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Payment received — your Coins will appear here as soon as it's confirmed (usually instant).
            </p>
          )}
          {searchParams.checkout === "cancelled" && (
            <p className="mt-4 rounded-lg bg-cinerra-surface px-3 py-2 text-sm text-cinerra-muted">Checkout cancelled — no charge was made.</p>
          )}

          <section className="card mt-6 text-center">
            <p className="text-sm text-cinerra-muted">Balance</p>
            <p className="mt-1 font-display text-4xl font-bold text-cinerra-text">🪙 {balance.toLocaleString()}</p>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Buy Coins</h2>
            {availableProviders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cinerra-border/80 bg-cinerra-surface/30 px-4 py-6 text-center text-sm text-cinerra-muted">
                Buying Coins isn't configured on this server yet.
              </p>
            ) : packages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cinerra-border/80 bg-cinerra-surface/30 px-4 py-6 text-center text-sm text-cinerra-muted">
                No Coin packages are available right now.
              </p>
            ) : (
              <BuyCoinsGrid packages={packages} availableProviders={availableProviders} />
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-cinerra-muted">Nothing here yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
                {recentActivity.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="text-cinerra-text">{TRANSACTION_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-xs text-cinerra-muted">{tx.createdAt.toLocaleString()}</p>
                    </div>
                    <span className={tx.amount >= 0 ? "font-medium text-emerald-400" : "font-medium text-cinerra-text"}>
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/current-business";
import { getActivePlan } from "@/lib/subscription";
import { getOrCreateWallet } from "@/lib/wallet";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentBusiness();
  if (!current) {
    redirect("/onboarding");
  }

  const [plan, wallet] = await Promise.all([
    getActivePlan(current.business.id),
    getOrCreateWallet(current.business.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar businessName={current.business.name} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <Topbar
          userName={current.session.user.name ?? current.session.user.email ?? "Merchant"}
          planName={plan?.name}
          businesses={current.allBusinesses.map((b) => ({ id: b.id, name: b.name }))}
          activeBusinessId={current.business.id}
          walletBalance={wallet.balance.toString()}
          currency={current.business.currency}
        />
        <main className="flex-1 bg-secondary/20 p-4 md:p-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

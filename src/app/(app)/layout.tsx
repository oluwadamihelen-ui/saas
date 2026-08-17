import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getCreditBalance } from "@/server/credits/ledger";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Topbar } from "@/components/dashboard/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const creditBalance = await getCreditBalance(session.user.id);

  return (
    <div className="flex min-h-screen flex-1">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={session.user.name ?? session.user.email ?? "Account"} creditBalance={creditBalance} />
        <main className="flex-1 bg-background p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

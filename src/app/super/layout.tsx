import Link from "next/link";
import { LayoutDashboard, Building2, Users, Settings } from "lucide-react";
import { auth } from "@/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { Logo } from "@/components/brand/logo";

const ICON_CLASS = "h-4 w-4";
const NAV_ITEMS = [
  { href: "/super", label: "Overview", icon: <LayoutDashboard className={ICON_CLASS} /> },
  { href: "/super/hotels", label: "Hotels", icon: <Building2 className={ICON_CLASS} /> },
  { href: "/super/users", label: "Platform Users", icon: <Users className={ICON_CLASS} /> },
  { href: "/super/settings", label: "Platform Settings", icon: <Settings className={ICON_CLASS} /> },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface p-4 lg:block">
        <Link href="/super" className="mb-6 flex items-center gap-2 px-2">
          <Logo height={26} />
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Super Admin</span>
        </Link>
        <SidebarNav items={NAV_ITEMS} basePath="/super" />
      </aside>
      <div className="flex flex-1 flex-col">
        <DashboardTopbar name={session?.user?.name ?? "Super Admin"} email={session?.user?.email ?? ""} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

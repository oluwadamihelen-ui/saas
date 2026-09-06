import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  GitBranch,
  ShoppingBag,
  Users,
  Rocket,
  Globe,
  Server,
  RefreshCcw,
  FileText,
  CreditCard,
  LifeBuoy,
  Plug,
  UserCog,
  BarChart3,
  Settings,
  ScrollText,
} from "lucide-react";
import { auth } from "@/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { Logo } from "@/components/brand/logo";

const ICON_CLASS = "h-4 w-4";
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className={ICON_CLASS} /> },
  { href: "/admin/applications", label: "Applications", icon: <Package className={ICON_CLASS} /> },
  { href: "/admin/versions", label: "Versions", icon: <GitBranch className={ICON_CLASS} /> },
  { href: "/admin/orders", label: "Orders", icon: <ShoppingBag className={ICON_CLASS} /> },
  { href: "/admin/customers", label: "Customers", icon: <Users className={ICON_CLASS} /> },
  { href: "/admin/deployments", label: "Deployments", icon: <Rocket className={ICON_CLASS} /> },
  { href: "/admin/domains", label: "Domains", icon: <Globe className={ICON_CLASS} /> },
  { href: "/admin/hosting", label: "Hosting", icon: <Server className={ICON_CLASS} /> },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: <RefreshCcw className={ICON_CLASS} /> },
  { href: "/admin/invoices", label: "Invoices", icon: <FileText className={ICON_CLASS} /> },
  { href: "/admin/payments", label: "Payments", icon: <CreditCard className={ICON_CLASS} /> },
  { href: "/admin/support", label: "Support", icon: <LifeBuoy className={ICON_CLASS} /> },
  { href: "/admin/providers", label: "Providers", icon: <Plug className={ICON_CLASS} /> },
  { href: "/admin/staff", label: "Staff", icon: <UserCog className={ICON_CLASS} /> },
  { href: "/admin/analytics", label: "Analytics", icon: <BarChart3 className={ICON_CLASS} /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings className={ICON_CLASS} /> },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: <ScrollText className={ICON_CLASS} /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 lg:block">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <Logo height={26} />
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Admin
          </span>
        </Link>
        <SidebarNav items={NAV_ITEMS} basePath="/admin" />
      </aside>
      <div className="flex flex-1 flex-col">
        <DashboardTopbar name={session?.user?.name ?? "Admin"} email={session?.user?.email ?? ""} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

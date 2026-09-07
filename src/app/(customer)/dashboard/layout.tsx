import Link from "next/link";
import { LayoutDashboard, ShoppingBag, FileText, Rocket, Globe, Server, RefreshCcw, LifeBuoy, User, MessageSquareText } from "lucide-react";
import { auth } from "@/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { Logo } from "@/components/brand/logo";

const ICON_CLASS = "h-4 w-4";
const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className={ICON_CLASS} /> },
  { href: "/dashboard/orders", label: "Orders", icon: <ShoppingBag className={ICON_CLASS} /> },
  { href: "/dashboard/invoices", label: "Invoices", icon: <FileText className={ICON_CLASS} /> },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: <RefreshCcw className={ICON_CLASS} /> },
  { href: "/dashboard/deployments", label: "Deployments", icon: <Rocket className={ICON_CLASS} /> },
  { href: "/dashboard/domains", label: "Domains", icon: <Globe className={ICON_CLASS} /> },
  { href: "/dashboard/hosting", label: "Hosting", icon: <Server className={ICON_CLASS} /> },
  { href: "/dashboard/support", label: "Support", icon: <LifeBuoy className={ICON_CLASS} /> },
  { href: "/dashboard/quotes", label: "Quotes", icon: <MessageSquareText className={ICON_CLASS} /> },
  { href: "/dashboard/profile", label: "Profile", icon: <User className={ICON_CLASS} /> },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface p-4 lg:block">
        <Link href="/" className="mb-6 flex items-center px-2">
          <Logo height={28} />
        </Link>
        <SidebarNav items={NAV_ITEMS} basePath="/dashboard" />
      </aside>
      <div className="flex flex-1 flex-col">
        <DashboardTopbar name={session?.user?.name ?? "Customer"} email={session?.user?.email ?? ""} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

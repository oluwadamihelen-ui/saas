import Link from "next/link";
import { requireHotelUser, getUserPermissions } from "@/lib/auth/require";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { HotelTopbar } from "@/components/dashboard/hotel-topbar";
import { Logo } from "@/components/brand/logo";
import { APP_NAV_ITEMS } from "@/components/dashboard/nav-items";
import { listMyHotels } from "@/lib/auth/hotel";
import { unreadNotificationCount } from "@/lib/services/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHotelUser();
  const [perms, hotels, unreadCount] = await Promise.all([
    getUserPermissions(user.id, user.hotelId),
    listMyHotels(),
    unreadNotificationCount(user.id),
  ]);

  const visibleItems = APP_NAV_ITEMS.filter((item) => !item.permission || perms.has(item.permission));
  const navItems = visibleItems.map((item) => ({ href: item.href, label: item.label, icon: <item.icon className="h-4 w-4" /> }));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 lg:block">
        <Link href="/app" className="mb-6 flex items-center px-2">
          <Logo height={28} />
        </Link>
        <SidebarNav items={navItems} basePath="/app" />
      </aside>
      <div className="flex flex-1 flex-col">
        <HotelTopbar
          name={user.name ?? "User"}
          email={user.email ?? ""}
          hotelName={user.hotelName}
          role={user.role}
          unreadCount={unreadCount}
          hotelOptions={hotels.map((h) => ({ hotelId: h.hotelId, hotelName: h.hotel.name }))}
        />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

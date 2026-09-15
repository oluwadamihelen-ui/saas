import { requireSuperAdmin } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { PlatformSidebar, PlatformMobileNav } from "@/components/platform/platform-sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireSuperAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar name={user.name} email={user.email} roleName="Super Admin" mobileNav={<PlatformMobileNav />} />
        <main className="container-shell min-w-0 flex-1 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

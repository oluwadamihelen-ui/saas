import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { getSchool, nextOnboardingStep } from "@/lib/services/school";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireSchoolUser();
  const school = await getSchool(sessionUser.schoolId);

  if (nextOnboardingStep(school) !== "done") {
    redirect("/onboarding");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: { role: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar name={user.name} email={user.email} roleName={user.role.name} />
        <main className="container-shell flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}

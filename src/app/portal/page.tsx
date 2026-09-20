import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";

export default async function PortalIndexPage() {
  const user = await requireSchoolUser();
  redirect(user.role === "STUDENT" ? "/portal/student" : "/portal/parent");
}

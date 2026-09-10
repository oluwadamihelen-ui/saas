import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getSchool, nextOnboardingStep } from "@/lib/services/school";

export default async function OnboardingIndexPage() {
  const user = await requireSchoolUser();
  const school = await getSchool(user.schoolId);
  const step = nextOnboardingStep(school);

  if (step === "done") redirect("/dashboard");
  redirect(`/onboarding/${step}`);
}

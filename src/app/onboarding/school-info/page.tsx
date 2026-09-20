import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getSchool } from "@/lib/services/school";
import { OnboardingStepper } from "../stepper";
import { SchoolInfoForm } from "./school-info-form";

export default async function SchoolInfoPage() {
  const user = await requireSchoolUser();
  const school = await getSchool(user.schoolId);

  return (
    <div>
      <OnboardingStepper current="school-info" />
      <Card>
        <CardHeader>
          <CardTitle>Tell us about your school</CardTitle>
          <CardDescription>This shows up on report cards, invoices and parent communication.</CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolInfoForm schoolName={school.name} currentPrefix={school.admissionNumberPrefix} />
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getSchool } from "@/lib/services/school";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireSchoolUser();
  const school = await getSchool(user.schoolId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted">School profile and branding.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>School profile</CardTitle>
          <CardDescription>Shown on report cards, invoices and parent communication.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm school={school} />
        </CardContent>
      </Card>
    </div>
  );
}

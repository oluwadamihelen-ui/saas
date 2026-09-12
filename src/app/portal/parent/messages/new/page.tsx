import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getGuardianForUser } from "@/lib/services/portal";
import { NewMessageForm } from "./new-message-form";

export default async function NewMessagePage() {
  const user = await requireSchoolUser();
  const guardian = await getGuardianForUser(user.schoolId, user.id);
  const kids = (guardian?.students ?? []).map((sg) => sg.student);

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New message</CardTitle>
        </CardHeader>
        <CardContent>
          <NewMessageForm kids={kids} />
        </CardContent>
      </Card>
    </div>
  );
}

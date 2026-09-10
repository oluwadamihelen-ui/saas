import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OnboardingStepper } from "../stepper";
import { SchoolInfoForm } from "./school-info-form";

export default function SchoolInfoPage() {
  return (
    <div>
      <OnboardingStepper current="school-info" />
      <Card>
        <CardHeader>
          <CardTitle>Tell us about your school</CardTitle>
          <CardDescription>This shows up on report cards, invoices and parent communication.</CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}

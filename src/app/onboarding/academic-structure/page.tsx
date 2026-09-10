import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OnboardingStepper } from "../stepper";
import { AcademicStructureForm } from "./academic-structure-form";

export default function AcademicStructurePage() {
  return (
    <div>
      <OnboardingStepper current="academic-structure" />
      <Card>
        <CardHeader>
          <CardTitle>Set up your academic structure</CardTitle>
          <CardDescription>The current session, terms, and classes students will be enrolled into.</CardDescription>
        </CardHeader>
        <CardContent>
          <AcademicStructureForm />
        </CardContent>
      </Card>
    </div>
  );
}

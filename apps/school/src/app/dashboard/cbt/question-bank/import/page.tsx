import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImportForm } from "./import-form";

const TEMPLATE_HEADER = "subjectcode,type,difficulty,topic,prompt,marks,option1,option1correct,option2,option2correct,option3,option3correct,option4,option4correct,explanation";
const TEMPLATE_EXAMPLE =
  'MTH,MULTIPLE_CHOICE,EASY,Fractions,"What is 1/2 + 1/4?",1,1/4,false,3/4,true,1/2,false,1,false,"Add the fractions using a common denominator."';

export default async function ImportQuestionsPage() {
  await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import questions</h1>
        <p className="text-sm text-muted">Upload a CSV of multiple choice, multiple select, or true/false questions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardDescription>One header row, then one question per row. Subject codes must match an existing subject.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted-surface p-3 text-xs text-foreground">
            {TEMPLATE_HEADER}
            {"\n"}
            {TEMPLATE_EXAMPLE}
          </pre>
          <p className="mt-2 text-xs text-muted">
            Only MULTIPLE_CHOICE, MULTIPLE_SELECT and TRUE_FALSE are supported via import — use the question form for essay,
            matching, ordering, short answer or fill-in-the-blank questions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}

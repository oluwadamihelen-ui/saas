import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects } from "@/lib/services/academics";
import { isCbtAiConfigured } from "@/lib/services/cbt-ai";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
import { GenerateForm } from "./generate-form";

export default async function GenerateQuestionsPage() {
  const user = await requirePermission(PERMISSIONS.CBT_GENERATE_AI_QUESTIONS);

  if (!isCbtAiConfigured()) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Generate questions with AI</h1>
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="AI isn't configured yet"
          description="Ask your platform administrator to set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable this feature."
        />
      </div>
    );
  }

  const subjects = await listSubjects(user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Generate questions with AI</h1>
        <p className="text-sm text-muted">Every generated question lands in the bank as pending review — nothing is usable in an exam until you approve it.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
          <CardDescription>Supports multiple choice, true/false, short answer, and essay.</CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateForm subjects={subjects} />
        </CardContent>
      </Card>
    </div>
  );
}

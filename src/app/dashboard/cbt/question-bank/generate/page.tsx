import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects } from "@/lib/services/academics";
import { getAccessibleSubjectIds } from "@/lib/services/teacher-scope";
import { isCbtAiConfigured } from "@/lib/services/cbt-ai";
import { hasFeature, getCbtAiMonthlyUsage, getCbtAiMonthlyLimit } from "@/lib/billing/entitlements";
import { FeatureLocked } from "@/components/billing/feature-locked";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
import { GenerateForm } from "./generate-form";

export default async function GenerateQuestionsPage() {
  const user = await requirePermission(PERMISSIONS.CBT_GENERATE_AI_QUESTIONS);
  const perms = await getUserPermissions(user.id);

  if (!(await hasFeature(user.schoolId, "cbt_ai_generation"))) {
    return (
      <FeatureLocked
        description="AI question generation isn't included in your current plan."
        canViewBilling={perms.has(PERMISSIONS.BILLING_VIEW)}
      />
    );
  }

  if (!isCbtAiConfigured()) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Generate questions with AI</h1>
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="AI isn't configured yet"
          description="Ask your platform administrator to set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable this feature."
        />
      </div>
    );
  }

  const [allSubjects, aiUsage, aiLimit] = await Promise.all([
    listSubjects(user.schoolId),
    getCbtAiMonthlyUsage(user.schoolId),
    getCbtAiMonthlyLimit(user.schoolId),
  ]);
  const subjectAccess = await getAccessibleSubjectIds(user.schoolId, user.id, perms);
  const subjects = subjectAccess === "ALL" ? allSubjects : allSubjects.filter((s) => subjectAccess.has(s.id));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Generate questions with AI</h1>
        <p className="text-sm text-muted">
          Every generated question lands in the bank as pending review — nothing is usable in an exam until you approve it.
          {aiLimit !== null && ` ${aiUsage} of ${aiLimit} AI questions used this month.`}
        </p>
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

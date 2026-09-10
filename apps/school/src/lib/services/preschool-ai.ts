import "server-only";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { computePreschoolReport, listAssessmentLevels } from "@/lib/services/preschool-results";

/// Grounded strictly in this one student's own milestone assessments —
/// same "JSON summary in, plain text out" shape as generateExamInsights in
/// cbt-ai.ts. The system prompt explicitly forbids inventing achievements
/// (brief section 19: "The AI must never invent achievements"); the
/// teacher reviews and can edit the result before it's ever saved — this
/// function only returns a draft, it never writes to PreschoolReport
/// itself.
const COMMENT_SYSTEM_PROMPT = `You write a short overall developmental comment for a pre-school/nursery student's term report, \
based ONLY on the milestone assessment data you are given (subject, topic, milestone, assessment level, and any teacher note per \
milestone). Never mention a skill, subject or achievement that is not present in the data. If the data is sparse, keep the comment \
short and general rather than inventing detail. Write 2-4 warm, specific, parent-readable sentences: what the child is doing well, \
and what they're still developing. Respond with ONLY the comment text — no preamble, no labels, no markdown.`;

export async function generatePreschoolOverallComment(schoolId: string, studentId: string, termId: string): Promise<string> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI comment generation isn't configured for this deployment.");

  const [{ student, subjects, summary }, levels] = await Promise.all([
    computePreschoolReport(schoolId, studentId, termId),
    listAssessmentLevels(schoolId),
  ]);
  const labelByLevel = new Map(levels.map((l) => [l.level, l.label]));

  if (subjects.every((s) => s.topics.every((t) => t.milestones.length === 0))) {
    throw new Error("No milestones have been assessed for this student yet — there's nothing to summarize.");
  }

  const data = {
    studentFirstName: student.firstName,
    subjects: subjects.map((s) => ({
      subject: s.subjectName,
      milestones: s.topics.flatMap((t) =>
        t.milestones.map((m) => ({ topic: t.topicTitle, milestone: m.title, level: labelByLevel.get(m.level) ?? m.level, comment: m.comment }))
      ),
    })),
    summaryCounts: Object.fromEntries(Object.entries(summary).map(([level, count]) => [labelByLevel.get(level as never) ?? level, count])),
  };

  const result = await provider.generate({
    systemPrompt: COMMENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(data) }],
    tools: [],
  });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");
  return result.text.trim();
}

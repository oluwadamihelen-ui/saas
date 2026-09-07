import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listGradeBands, listAssessmentComponents } from "@/lib/services/results";
import { GradeBandForm, ComponentForm } from "./grading-forms";
import { DeleteGradeBandButton, DeleteComponentButton } from "./delete-buttons";

export default async function GradingSetupPage() {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);
  const [bands, components] = await Promise.all([
    listGradeBands(user.schoolId),
    listAssessmentComponents(user.schoolId),
  ]);

  const totalMax = components.reduce((sum, c) => sum + c.maxScore, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Grading setup</h1>
        <p className="text-sm text-muted">Configure how subject scores are structured and graded.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment components</CardTitle>
          <CardDescription>
            A subject&apos;s total is the sum of these. Currently sums to {totalMax}
            {totalMax !== 100 && " — most schools use 100"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ComponentForm />
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Max score</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {components.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-muted">{c.maxScore}</TableCell>
                  <TableCell className="text-right"><DeleteComponentButton id={c.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade bands</CardTitle>
          <CardDescription>Maps a subject&apos;s total score to a letter grade and remark.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GradeBandForm />
          <Table>
            <TableHeader>
              <TableRow><TableHead>Grade</TableHead><TableHead>Range</TableHead><TableHead>Remark</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.grade}</TableCell>
                  <TableCell className="text-muted">{b.minScore}–{b.maxScore}</TableCell>
                  <TableCell className="text-muted">{b.remark}</TableCell>
                  <TableCell className="text-right"><DeleteGradeBandButton id={b.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

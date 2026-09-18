import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { MilestoneColumn, MilestoneGridRow } from "./milestone-grid-form";

const VARIANTS = ["neutral", "accent", "secondary", "success", "warning", "danger"] as const;
type BadgeVariant = (typeof VARIANTS)[number];

export function MilestoneGridReadOnly({
  milestones,
  rows,
  levels,
}: {
  milestones: MilestoneColumn[];
  rows: MilestoneGridRow[];
  levels: { level: string; label: string; colorVariant: string }[];
}) {
  const byLevel = new Map(levels.map((l) => [l.level, l]));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            {milestones.map((m) => (
              <TableHead key={m.id} className="min-w-[200px]">
                <span className="block text-xs text-muted">Week {m.weekNumber} · {m.topicTitle}</span>
                {m.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ student, values }) => (
            <TableRow key={student.id}>
              <TableCell className="align-top font-medium">{student.firstName} {student.lastName}</TableCell>
              {milestones.map((m, i) => {
                const v = values[i];
                const level = v.level ? byLevel.get(v.level) : null;
                return (
                  <TableCell key={m.id} className="align-top">
                    {level ? (
                      <div className="space-y-1">
                        <Badge variant={(VARIANTS.includes(level.colorVariant as BadgeVariant) ? level.colorVariant : "neutral") as BadgeVariant}>
                          {level.label}
                        </Badge>
                        {v.comment && <p className="text-xs text-muted">{v.comment}</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Not assessed</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

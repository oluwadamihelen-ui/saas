import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function ScoreGridReadOnly({
  components,
  rows,
}: {
  components: { id: string; name: string; maxScore: number }[];
  rows: { student: { id: string; firstName: string; lastName: string }; values: (number | null)[] }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          {components.map((c) => (
            <TableHead key={c.id}>{c.name} <span className="text-muted">/{c.maxScore}</span></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ student, values }) => (
          <TableRow key={student.id}>
            <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
            {components.map((c, i) => (
              <TableCell key={c.id}>{values[i] ?? "—"}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

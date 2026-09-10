import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listStudents } from "@/lib/services/students";
import { listClassArms } from "@/lib/services/academics";
import type { StudentStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<StudentStatus, "success" | "warning" | "neutral" | "danger"> = {
  ACTIVE: "success",
  GRADUATED: "neutral",
  WITHDRAWN: "warning",
  SUSPENDED: "danger",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classArmId?: string; status?: string; page?: string }>;
}) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canEnroll = perms.has(PERMISSIONS.STUDENTS_CREATE);
  const params = await searchParams;

  const [{ students, total, page, pageCount }, classArms] = await Promise.all([
    listStudents(user.schoolId, {
      search: params.q,
      classArmId: params.classArmId,
      status: (params.status as StudentStatus) || undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    listClassArms(user.schoolId),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
          <p className="text-sm text-muted">{total} student{total === 1 ? "" : "s"}</p>
        </div>
        {canEnroll && (
          <Button asChild>
            <Link href="/dashboard/students/new">Enroll a student</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="q">Search</label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Name or admission number" />
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={params.classArmId ?? ""}>
                <option value="">All classes</option>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Any status</option>
                <option value="ACTIVE">Active</option>
                <option value="GRADUATED">Graduated</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {students.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No students found"
              description={canEnroll ? "Try a different search, or enroll a new student." : "Try a different search."}
              action={
                canEnroll ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/students/new">Enroll a student</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/dashboard/students/${s.id}`} className="font-medium text-foreground hover:text-accent">
                        {s.firstName} {s.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{s.admissionNumber}</TableCell>
                    <TableCell className="text-muted">
                      {s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/students" query={params} />
        </CardContent>
      </Card>
    </div>
  );
}

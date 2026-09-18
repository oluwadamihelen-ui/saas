import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listApplicants } from "@/lib/services/admission";
import { formatDate } from "@/lib/utils";
import type { ApplicantStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<ApplicantStatus, "success" | "warning" | "neutral" | "danger" | "accent"> = {
  APPLIED: "neutral",
  UNDER_REVIEW: "warning",
  OFFERED: "accent",
  ACCEPTED: "success",
  REJECTED: "danger",
  ENROLLED: "success",
};

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.ADMISSION_VIEW);
  const params = await searchParams;
  const status = (params.status as ApplicantStatus) || undefined;

  const { applicants, total, page, pageCount } = await listApplicants(user.schoolId, status, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Applicants</h1>
          <p className="text-sm text-muted">{total} application{total === 1 ? "" : "s"}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/administration/admission/fee">Set Admission Fee</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Any status</option>
                <option value="APPLIED">Applied</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="OFFERED">Offered</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="ENROLLED">Enrolled</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {applicants.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-6 w-6" />}
              title="No applicants found"
              description="Share your public application link, or try a different filter."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Desired class</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicants.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/dashboard/administration/admission/${a.id}`} className="font-medium text-foreground hover:text-accent">
                        {a.childFirstName} {a.childLastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{a.parentName}</TableCell>
                    <TableCell className="text-muted">{a.desiredClassGroup?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted">{a.feeStatus.replace("_", " ")}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{a.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/administration/admission" query={params} />
        </CardContent>
      </Card>
    </div>
  );
}

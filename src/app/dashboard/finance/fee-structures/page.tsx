import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listFeeCategories, listFeeStructures } from "@/lib/services/fee-structures";
import { listClassGroups, listTerms } from "@/lib/services/academics";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { FeeCategoryForm, FeeStructureForm } from "./forms";
import { DeleteCategoryButton, DeleteStructureButton } from "./delete-buttons";

export default async function FeeStructuresPage() {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const [categories, structures, classGroups, terms, school] = await Promise.all([
    listFeeCategories(user.schoolId),
    listFeeStructures(user.schoolId),
    listClassGroups(user.schoolId),
    listTerms(user.schoolId),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fee structures</h1>
        <p className="text-sm text-muted">Configure what&apos;s charged, to which classes, per term.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Tuition, transport, boarding, uniforms, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeeCategoryForm />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-sm">
                {c.name}
                <DeleteCategoryButton id={c.id} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee structures</CardTitle>
          <CardDescription>Each row is an amount charged for a category, optionally limited to one class, for a term.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeeStructureForm categories={categories} classGroups={classGroups} terms={terms} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-muted">{s.category.name}</TableCell>
                  <TableCell className="text-muted">{s.classGroup?.name ?? "All classes"}</TableCell>
                  <TableCell className="text-muted">{s.term.name}</TableCell>
                  <TableCell>{formatMoney(s.amountMinor, school.currency)}</TableCell>
                  <TableCell className="text-right"><DeleteStructureButton id={s.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

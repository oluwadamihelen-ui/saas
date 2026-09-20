import Link from "next/link";
import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { BirthdayListItem } from "@/components/dashboard/birthday-list-item";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms } from "@/lib/services/academics";
import { getSchool } from "@/lib/services/school";
import { listBirthdays, schoolLocalToday, MONTH_NAMES, type BirthdayPersonType } from "@/lib/services/birthdays";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

type ViewKey = "upcoming" | "today" | "month";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "month", label: "This Month" },
];

export default async function BirthdaysPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; type?: string; classArmId?: string; month?: string; search?: string; page?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.BIRTHDAYS_VIEW);
  const params = await searchParams;

  const view: ViewKey = VIEWS.some((v) => v.key === params.view) ? (params.view as ViewKey) : "upcoming";
  const type: BirthdayPersonType | undefined = params.type === "STUDENT" || params.type === "STAFF" ? params.type : undefined;
  const classArmId = params.classArmId || undefined;
  const search = params.search || undefined;

  const [school, classArms] = await Promise.all([getSchool(user.schoolId), listClassArms(user.schoolId)]);
  const today = schoolLocalToday(school.timezone);
  const selectedMonth = view === "month" ? Number(params.month) || today.month : undefined;

  const all = await listBirthdays(user.schoolId, school.timezone, { type, classArmId, search });

  let people = all;
  if (view === "today") {
    people = all.filter((p) => p.isToday);
  } else if (view === "month" && selectedMonth) {
    people = all.filter((p) => p.month === selectedMonth).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  }

  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const pageItems = people.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterQuery = { view, type: params.type, classArmId, month: params.month, search };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Cake className="h-6 w-6 text-accent" /> Birthdays
        </h1>
        <p className="text-sm text-muted">Every active student and staff birthday on file, always sourced from their date of birth — never entered separately.</p>
      </div>

      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted-surface p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={{ pathname: "/dashboard/birthdays", query: { ...filterQuery, view: v.key, page: undefined } }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === v.key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by name, or narrow to students, staff, a class, or (in This Month) a specific month.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input type="hidden" name="view" value={view} />
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="search">Search</label>
              <Input id="search" name="search" defaultValue={search ?? ""} placeholder="Student or staff name" />
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="type">Person type</label>
              <Select id="type" name="type" defaultValue={params.type ?? ""}>
                <option value="">Students & Staff</option>
                <option value="STUDENT">Students</option>
                <option value="STAFF">Staff</option>
              </Select>
            </div>
            <div className="w-52 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                <option value="">All classes</option>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            {view === "month" && (
              <div className="w-44 space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="month">Month</label>
                <Select id="month" name="month" defaultValue={String(selectedMonth ?? today.month)}>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {view === "today" ? "Today's birthdays" : view === "month" ? `${MONTH_NAMES[(selectedMonth ?? today.month) - 1]} birthdays` : "Upcoming birthdays"}
          </CardTitle>
          <CardDescription>{people.length} {people.length === 1 ? "person" : "people"}.</CardDescription>
        </CardHeader>
        <CardContent>
          {pageItems.length === 0 ? (
            <EmptyState
              title="No birthdays to display."
              description="Try a different filter, or check back once more dates of birth are on file."
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {pageItems.map((p) => (
                  <BirthdayListItem key={`${p.type}-${p.id}`} person={p} />
                ))}
              </ul>
              <Pagination page={page} pageCount={pageCount} basePath="/dashboard/birthdays" query={filterQuery} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

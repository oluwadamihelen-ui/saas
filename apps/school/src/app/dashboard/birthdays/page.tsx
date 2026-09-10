import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BirthdayList } from "@/components/dashboard/birthday-list";
import { requireAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  getUpcomingBirthdays,
  getMonthBirthdays,
  searchBirthdays,
  listClassGroupsForBirthdayFilter,
  listDepartmentsForBirthdayFilter,
  schoolToday,
  type BirthdayPersonType,
} from "@/lib/services/birthdays";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function BirthdaysPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; classGroupId?: string; departmentId?: string; month?: string; q?: string }>;
}) {
  const user = await requireAnyPermission([PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STAFF_VIEW]);
  const canViewStudents = user.perms.has(PERMISSIONS.STUDENTS_VIEW);
  const canViewStaff = user.perms.has(PERMISSIONS.STAFF_VIEW);
  const params = await searchParams;

  const school = await prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } });

  // A person type outside what this user is actually allowed to see is
  // silently narrowed back down — the type filter can only ever restrict
  // within the caller's own permissions, never expand past them.
  const requestedType = params.type === "STUDENT" || params.type === "STAFF" ? params.type : undefined;
  const allowedTypes: BirthdayPersonType[] = [
    ...(canViewStudents ? (["STUDENT"] as const) : []),
    ...(canViewStaff ? (["STAFF"] as const) : []),
  ];
  const types: BirthdayPersonType[] = requestedType && allowedTypes.includes(requestedType) ? [requestedType] : allowedTypes;

  const classGroupId = canViewStudents && params.classGroupId ? params.classGroupId : undefined;
  const departmentId = canViewStudents && params.departmentId ? params.departmentId : undefined;
  const query = params.q?.trim() ?? "";
  const selectedMonth = params.month ? Number(params.month) : schoolToday(school.timezone).getMonth() + 1;

  const [classGroups, departments] = await Promise.all([
    canViewStudents ? listClassGroupsForBirthdayFilter(user.schoolId) : Promise.resolve([]),
    canViewStudents ? listDepartmentsForBirthdayFilter(user.schoolId) : Promise.resolve([]),
  ]);

  const filterOpts = { types, classGroupId, departmentId };
  // The "Upcoming" tab is a browsing view, not the whole roster — capped at
  // a generous but bounded count so it stays readable; narrow by month,
  // class or search to see further out or find someone specific.
  const UPCOMING_TAB_LIMIT = 30;

  const searchResults = query
    ? await searchBirthdays(user.schoolId, school.timezone, query, filterOpts)
    : null;

  const [upcoming, monthBirthdays] = searchResults
    ? [[], []]
    : await Promise.all([
        getUpcomingBirthdays(user.schoolId, school.timezone, { ...filterOpts, limit: UPCOMING_TAB_LIMIT }),
        getMonthBirthdays(user.schoolId, school.timezone, selectedMonth, filterOpts),
      ]);
  const today = searchResults ? [] : upcoming.filter((e) => e.isToday);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Cake className="h-6 w-6 text-accent" /> Birthdays
        </h1>
        <p className="text-sm text-muted">Upcoming, today&apos;s and monthly birthdays for active students and staff.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filters apply across every view below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
            {allowedTypes.length > 1 && (
              <div className="w-40 space-y-1.5">
                <Label htmlFor="type">Person type</Label>
                <Select id="type" name="type" defaultValue={requestedType ?? ""}>
                  <option value="">All</option>
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Staff</option>
                </Select>
              </div>
            )}
            {canViewStudents && classGroups.length > 0 && (
              <div className="w-48 space-y-1.5">
                <Label htmlFor="classGroupId">Class</Label>
                <Select id="classGroupId" name="classGroupId" defaultValue={classGroupId ?? ""}>
                  <option value="">All classes</option>
                  {classGroups.map((cg) => (
                    <option key={cg.id} value={cg.id}>{cg.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {canViewStudents && departments.length > 0 && (
              <div className="w-48 space-y-1.5">
                <Label htmlFor="departmentId">Department</Label>
                <Select id="departmentId" name="departmentId" defaultValue={departmentId ?? ""}>
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="w-56 space-y-1.5">
              <Label htmlFor="q">Search by name</Label>
              <Input id="q" name="q" placeholder="Search students or staff" defaultValue={query} />
            </div>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {searchResults ? (
        <Card>
          <CardHeader>
            <CardTitle>Search results</CardTitle>
            <CardDescription>{searchResults.length} match{searchResults.length === 1 ? "" : "es"} for &quot;{query}&quot;</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <BirthdayList entries={searchResults} emptyMessage="No one matches that search." />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming birthdays</CardTitle>
                <CardDescription>
                  The next {UPCOMING_TAB_LIMIT} matching birthdays, soonest first. Use This Month or Search to look further ahead.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <BirthdayList entries={upcoming} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="today">
            <Card>
              <CardHeader><CardTitle>Today&apos;s birthdays</CardTitle></CardHeader>
              <CardContent className="p-0">
                <BirthdayList entries={today} emptyMessage="No one has a birthday today." />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="month">
            <Card>
              <CardHeader>
                <CardTitle>{MONTHS[selectedMonth - 1]} birthdays</CardTitle>
                <CardDescription>Everyone born in this month, by day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="flex items-end gap-3" method="get">
                  {requestedType && <input type="hidden" name="type" value={requestedType} />}
                  {classGroupId && <input type="hidden" name="classGroupId" value={classGroupId} />}
                  {departmentId && <input type="hidden" name="departmentId" value={departmentId} />}
                  <div className="w-48 space-y-1.5">
                    <Label htmlFor="month">Month</Label>
                    <Select id="month" name="month" defaultValue={String(selectedMonth)}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" variant="secondary" size="sm">Go</Button>
                </form>
                <BirthdayList entries={monthBirthdays} emptyMessage={`No birthdays in ${MONTHS[selectedMonth - 1]}.`} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

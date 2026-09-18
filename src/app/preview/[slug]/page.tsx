import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crown, BookOpen, UserRound, Backpack, type LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { SchoolLogo } from "@/components/brand/school-logo";
import { BrandStyle } from "@/components/brand/brand-style";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DemoRoleButton } from "@/components/demo/demo-role-button";
import { brand } from "@/lib/brand";

/// A per-prospect sales preview: everything here reads from a real School
/// row created by prisma/scripts/create-prospect-preview.ts, so a visitor
/// sees that school's own logo/name/colors and real (seeded) data instead
/// of Schoolum's own marketing chrome or the shared Horizon Academy demo —
/// the whole point is "look what we already built for you", not "here's
/// our product". Deliberately not wrapped in MarketingPageShell for that
/// reason: this page has no nav back to the marketing site.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const school = await prisma.school.findUnique({ where: { slug }, select: { name: true } });
  return { title: school ? `${school.name} — Schoolum Preview` : "Preview — Schoolum" };
}

const PREVIEW_ROLES: { role: "SCHOOL_OWNER" | "TEACHER" | "PARENT" | "STUDENT"; label: string; description: string; icon: LucideIcon }[] = [
  { role: "SCHOOL_OWNER", label: "School Owner", description: "Full access — billing, settings, and every module.", icon: Crown },
  { role: "TEACHER", label: "Teacher", description: "Classes, results, assignments, and attendance.", icon: BookOpen },
  { role: "PARENT", label: "Parent", description: "The parent portal — a child's fees, results, and attendance.", icon: UserRound },
  { role: "STUDENT", label: "Student", description: "The student portal — assignments, results, and timetable.", icon: Backpack },
];

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-muted-surface">
      <BrandStyle color={school.brandColor} />

      <header className="border-b border-border bg-surface">
        <div className="container-shell flex items-center justify-between py-5">
          <SchoolLogo name={school.name} logoUrl={school.logoUrl} height={36} />
          <span className="rounded-full border border-border bg-muted-surface px-3 py-1 text-xs font-medium text-muted">
            Personalized Preview
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-shell py-14 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              See how Schoolum works for {school.name}
            </h1>
            <p className="text-lg text-muted">
              This is a live preview set up just for {school.name}, with real classes, students, fees and results already
              in it. Pick a role below to sign in instantly and look around.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            {PREVIEW_ROLES.map(({ role, label, description, icon: Icon }) => (
              <Card key={role}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <CardTitle>{label}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <DemoRoleButton email={`${role.toLowerCase().replace("school_", "")}@${slug}.preview`} label={label} />
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-md text-center text-sm text-muted">
            Feel free to click around — nothing here affects a real school. Built on{" "}
            <span className="font-medium text-foreground">{brand.name}</span>.
          </p>
        </div>
      </main>
    </div>
  );
}

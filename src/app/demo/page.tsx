import { Crown, Settings, GraduationCap, BookOpen, Wallet, Users, Library, Bus, UserRound, Backpack, type LucideIcon } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DemoRoleButton } from "@/components/demo/demo-role-button";
import { DEMO_ROLE_EMAILS, DEMO_ROLE_DESCRIPTIONS, DEMO_ROLE_ORDER } from "@/lib/demo";
import { SYSTEM_ROLE_LABELS, type SystemRoleKey } from "@/lib/permissions";

export const metadata = { title: "Live Demo — Schoolum" };

const ROLE_ICONS: Record<SystemRoleKey, LucideIcon> = {
  SCHOOL_OWNER: Crown,
  SCHOOL_ADMIN: Settings,
  PRINCIPAL: GraduationCap,
  TEACHER: BookOpen,
  ACCOUNTANT: Wallet,
  HR_STAFF: Users,
  LIBRARIAN: Library,
  TRANSPORT_MANAGER: Bus,
  PARENT: UserRound,
  STUDENT: Backpack,
};

export default function DemoPage() {
  return (
    <MarketingPageShell
      eyebrow="Live Product Demo"
      title="Explore Schoolum as any role"
      description={`This is "Horizon Academy" — a fully seeded sample school with real classes, students, fees, results and more. Pick a role below to sign in instantly, no account needed.`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DEMO_ROLE_ORDER.map((role) => {
          const Icon = ROLE_ICONS[role];
          return (
            <Card key={role}>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <CardTitle>{SYSTEM_ROLE_LABELS[role]}</CardTitle>
                  <CardDescription>{DEMO_ROLE_DESCRIPTIONS[role]}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <DemoRoleButton email={DEMO_ROLE_EMAILS[role]} label={SYSTEM_ROLE_LABELS[role]} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted">
        Everything here is sample data reset periodically — feel free to click around, nothing you do here affects a real school.
      </p>
    </MarketingPageShell>
  );
}

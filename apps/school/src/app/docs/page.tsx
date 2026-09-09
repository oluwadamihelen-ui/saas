import Link from "next/link";
import {
  Users, GraduationCap, CalendarCheck, Wallet, MessageSquare, Sparkles,
  MonitorCheck, Building2, ShieldCheck,
} from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata = { title: "Documentation — Winfield" };

const MODULES = [
  { icon: Users, title: "Students & staff", description: "Enrollment, class arms, teacher assignments and staff records for your whole school." },
  { icon: GraduationCap, title: "Academics", description: "Timetables, assignments, assessments, results and printable report cards." },
  { icon: CalendarCheck, title: "Attendance", description: "Daily attendance capture with class- and student-level reporting." },
  { icon: Wallet, title: "Finance", description: "Fee structures, invoicing, online and manual payments, receipts and expenses." },
  { icon: MessageSquare, title: "Communication", description: "Announcements, direct messaging, and dedicated parent and student portals." },
  { icon: MonitorCheck, title: "Computer-based testing", description: "Question banks, timed online exams, auto- and manual grading, and results analytics." },
  { icon: Sparkles, title: "AI assistant", description: "A permission-gated assistant that can answer questions and take actions across the platform, with every AI-generated result reviewed by a human before it counts." },
  { icon: Building2, title: "Operations", description: "Payroll, library, transport and hostel management for schools that need them." },
  { icon: ShieldCheck, title: "Security & administration", description: "Role-based permissions, an audit log, and school-wide settings, all scoped to your school alone." },
];

export default function DocsPage() {
  return (
    <MarketingPageShell
      eyebrow="Documentation"
      title="How Winfield works"
      description="An overview of what's included in the platform. Sign in to your dashboard for guided help inside each module."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <div key={mod.title} className="rounded-lg border border-border bg-surface p-6">
            <mod.icon className="h-6 w-6 text-accent" />
            <h2 className="mt-4 text-base font-semibold text-foreground">{mod.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{mod.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted-surface/60 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Ready to see it in action?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Start your free trial
          </Link>{" "}
          — or check our{" "}
          <Link href="/help" className="font-medium text-accent hover:underline">
            Help Center
          </Link>{" "}
          for common questions.
        </p>
      </div>
    </MarketingPageShell>
  );
}

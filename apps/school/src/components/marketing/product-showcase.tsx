import { CheckCircle2, Users, BookOpen, Wallet, ClipboardCheck } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const STUDENTS = [
  { name: "Ada Chukwu", initials: "AC", cls: "JSS 2A", status: "Active" },
  { name: "Yusuf Bello", initials: "YB", cls: "Primary 5B", status: "Active" },
  { name: "Grace Okon", initials: "GO", cls: "SSS 1C", status: "Active" },
];

const RESULTS = [
  { subject: "Mathematics", score: 88, grade: "A" },
  { subject: "English Language", score: 74, grade: "B" },
  { subject: "Basic Science", score: 91, grade: "A" },
];

const PAYMENTS = [
  { label: "2nd Term Tuition — JSS 3", amount: "₦120,000", status: "Paid" },
  { label: "Boarding Fee — SSS 1", amount: "₦85,000", status: "Paid" },
  { label: "Excursion Fee — Primary 4", amount: "₦15,000", status: "Pending" },
];

const CLASS_ATTENDANCE = [
  { cls: "Nursery 1", value: 97 },
  { cls: "Primary 4B", value: 92 },
  { cls: "JSS 2A", value: 89 },
  { cls: "SSS 1C", value: 95 },
];

function ShowcaseFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_20px_45px_-20px_rgba(19,26,43,0.2)] sm:p-6">
      {children}
    </div>
  );
}

const SECTIONS = [
  {
    id: "product",
    eyebrow: "Student Management",
    title: "Every student record, centralized.",
    description:
      "Profiles, enrollment history, guardians, class placement and academic records — all in one searchable place, instead of scattered spreadsheets.",
    points: ["Centralized student profiles", "Guardian & family records", "Class & enrollment history"],
    icon: Users,
    visual: (
      <ShowcaseFrame>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Students</p>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">1,248 total</span>
        </div>
        <div className="space-y-2">
          {STUDENTS.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {s.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">{s.cls}</p>
                </div>
              </div>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{s.status}</span>
            </div>
          ))}
        </div>
      </ShowcaseFrame>
    ),
  },
  {
    id: "academics",
    eyebrow: "Academics & Results",
    title: "From assessments to report cards, in sync.",
    description:
      "Set up classes and subjects, record continuous assessments and exam scores, and generate report cards automatically — no manual grade collation.",
    points: ["Configurable grading & assessments", "Auto-computed report cards", "Class & subject performance"],
    icon: BookOpen,
    visual: (
      <ShowcaseFrame>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Report Card — Ada Chukwu</p>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Term Avg: 84%</span>
        </div>
        <div className="space-y-2">
          {RESULTS.map((r) => (
            <div key={r.subject} className="flex items-center justify-between rounded-lg border border-border p-3">
              <p className="text-sm text-foreground">{r.subject}</p>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted-surface">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${r.score}%` }} />
                </div>
                <span className="w-7 text-right text-xs font-semibold text-foreground">{r.grade}</span>
              </div>
            </div>
          ))}
        </div>
      </ShowcaseFrame>
    ),
  },
  {
    id: "finance",
    eyebrow: "Fees & Finance",
    title: "Know exactly what's collected — and what's not.",
    description:
      "Generate invoices, accept online or manual payments, and track outstanding balances by student, class or term in real time.",
    points: ["Online & manual payment recording", "Outstanding balance tracking", "Revenue reporting by term"],
    icon: Wallet,
    visual: (
      <ShowcaseFrame>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Recent Payments</p>
          <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">₦2.4M pending</span>
        </div>
        <div className="space-y-2">
          {PAYMENTS.map((p) => (
            <div key={p.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm text-foreground">{p.label}</p>
                <p className="text-xs text-muted">{p.amount}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  p.status === "Paid" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                )}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </ShowcaseFrame>
    ),
  },
  {
    id: "attendance",
    eyebrow: "Attendance",
    title: "Attendance, tracked class by class.",
    description:
      "Staff mark attendance in seconds, and administrators see school-wide and per-class trends instantly — no more paper registers.",
    points: ["One-tap daily attendance", "Class & school-wide trends", "Automatic absence patterns"],
    icon: ClipboardCheck,
    visual: (
      <ShowcaseFrame>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Attendance by Class — Today</p>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">94% avg</span>
        </div>
        <div className="space-y-3">
          {CLASS_ATTENDANCE.map((c) => (
            <div key={c.cls}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-foreground">{c.cls}</span>
                <span className="font-medium text-muted">{c.value}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted-surface">
                <div className="h-full rounded-full bg-accent" style={{ width: `${c.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </ShowcaseFrame>
    ),
  },
];

export function ProductShowcase() {
  return (
    <section id="product" className="scroll-mt-20 bg-muted-surface/60 py-20 sm:py-28">
      <div className="container-shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Product</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            One connected platform for your entire school.
          </h2>
        </Reveal>

        <div className="mt-16 space-y-20 sm:space-y-28">
          {SECTIONS.map((section, i) => (
            <div
              key={section.id}
              className={cn(
                "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16",
                i % 2 === 1 && "lg:[&>*:first-child]:order-2"
              )}
            >
              <Reveal>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <section.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium uppercase tracking-wide text-accent">{section.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{section.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-muted">{section.description}</p>
                <ul className="mt-6 space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-center gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success" />
                      {point}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delayMs={100}>{section.visual}</Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

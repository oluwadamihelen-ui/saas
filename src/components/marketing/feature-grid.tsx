import { Users, UserCog, ClipboardCheck, Wallet, BookOpen, MessageSquare, BarChart3, ShieldCheck } from "lucide-react";
import { Reveal } from "./reveal";

const FEATURES = [
  {
    title: "Student Management",
    description: "Manage student profiles, enrollment and academic information from one place.",
    icon: Users,
  },
  {
    title: "Staff Management",
    description: "Manage teachers, staff records and responsibilities.",
    icon: UserCog,
  },
  {
    title: "Smart Attendance",
    description: "Track student and staff attendance quickly and accurately.",
    icon: ClipboardCheck,
  },
  {
    title: "Fees & Payments",
    description: "Monitor school fees, payments and outstanding balances.",
    icon: Wallet,
  },
  {
    title: "Academics & Results",
    description: "Manage classes, subjects, assessments, results and report cards.",
    icon: BookOpen,
  },
  {
    title: "Parent Communication",
    description: "Keep parents informed with important school updates.",
    icon: MessageSquare,
  },
  {
    title: "Reports & Analytics",
    description: "Make smarter decisions with real-time school insights.",
    icon: BarChart3,
  },
  {
    title: "Secure Cloud Access",
    description: "Access your school information securely from anywhere.",
    icon: ShieldCheck,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Features</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything your school needs to run smoothly.
          </h2>
          <p className="mt-4 text-lg text-muted">
            One connected platform, built to replace the spreadsheets, notebooks and disconnected tools most schools
            juggle every day.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delayMs={(i % 4) * 70}>
              <div className="group h-full rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

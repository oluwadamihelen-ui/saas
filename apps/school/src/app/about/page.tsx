import Link from "next/link";
import { GraduationCap, Heart, ShieldCheck, Sparkles } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata = { title: "About — Winfield" };

const VALUES = [
  {
    icon: GraduationCap,
    title: "Built for how schools actually run",
    description:
      "Admissions, attendance, fees, exams and communication rarely live in separate silos in real school life — so we don't split them into separate products either.",
  },
  {
    icon: ShieldCheck,
    title: "Every school's data stays its own",
    description:
      "Winfield is multi-tenant by design: one school's records, results and finances are never visible to another, enforced at every layer of the platform, not just the interface.",
  },
  {
    icon: Sparkles,
    title: "AI that assists, never decides alone",
    description:
      "From report-card drafting to AI-generated exam questions, every AI suggestion in Winfield is reviewed and approved by a human before it becomes part of a student's record.",
  },
  {
    icon: Heart,
    title: "Made with African schools in mind",
    description:
      "From term structures to Naira-first billing to low-bandwidth-friendly pages, Winfield is designed around the schools we build it for, not adapted from somewhere else.",
  },
];

export default function AboutPage() {
  return (
    <MarketingPageShell
      eyebrow="About Winfield"
      title="Modern school management, built for African schools"
      description="Winfield brings students, staff, academics, attendance, finance and communication into one platform — so school leaders spend less time switching between spreadsheets and more time running their school."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {VALUES.map((value) => (
          <div key={value.title} className="rounded-lg border border-border bg-surface p-6">
            <value.icon className="h-6 w-6 text-accent" />
            <h2 className="mt-4 text-base font-semibold text-foreground">{value.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{value.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted-surface/60 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Curious what Winfield looks like for your school? Explore our{" "}
          <Link href="/pricing" className="font-medium text-accent hover:underline">
            plans and pricing
          </Link>{" "}
          or{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            start a free trial
          </Link>
          .
        </p>
      </div>
    </MarketingPageShell>
  );
}

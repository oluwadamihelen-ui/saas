import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata = { title: "Help Center — Schoolum" };

const FAQS = [
  {
    question: "How do I get started?",
    answer:
      "Go to Get started and walk through the onboarding wizard — school details, your first academic term, and inviting staff. Every new school starts on a 14-day free trial with full Professional-tier access, no card required.",
  },
  {
    question: "What's included in a trial?",
    answer:
      "Everything on the Professional plan: student, staff and academic management, attendance, finance, communication, the AI assistant, and computer-based testing (CBT). See the Pricing page for the full comparison across plans.",
  },
  {
    question: "Can parents and students see the platform too?",
    answer:
      "Yes — parents and students each get their own portal (attendance, results, fees, announcements, messaging, and CBT exams for students) once a school invites them. Staff manage everything from the main dashboard.",
  },
  {
    question: "Is our school's data shared with other schools?",
    answer:
      "No. Schoolum is multi-tenant: every school's students, staff, finances and results are isolated from every other school, enforced on the server for every request — not just hidden in the interface.",
  },
  {
    question: "How does the AI assistant work?",
    answer:
      "It's a permission-gated assistant built into the dashboard that can answer questions and take actions you're allowed to take yourself. AI-generated content — exam questions, report comments — always needs a human to review and approve it before it becomes official.",
  },
  {
    question: "I'm stuck, or found a bug. What do I do?",
    answer:
      "If you already have an account, sign in and use the Feedback section of your dashboard — it reaches your school's admins and our team directly. Otherwise, reach out from the Contact page.",
  },
];

export default function HelpPage() {
  return (
    <MarketingPageShell
      eyebrow="Help Center"
      title="Frequently asked questions"
      description="Can't find what you're looking for? Reach out from our Contact page."
    >
      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {FAQS.map((faq) => (
          <div key={faq.question} className="p-6">
            <h2 className="text-base font-semibold text-foreground">{faq.question}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{faq.answer}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted-surface/60 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Still have questions?{" "}
          <Link href="/contact" className="font-medium text-accent hover:underline">
            Get in touch
          </Link>{" "}
          or browse our{" "}
          <Link href="/docs" className="font-medium text-accent hover:underline">
            documentation
          </Link>
          .
        </p>
      </div>
    </MarketingPageShell>
  );
}

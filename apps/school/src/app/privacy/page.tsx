import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata = { title: "Privacy Policy — Winfield" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <MarketingPageShell eyebrow="Legal" title="Privacy Policy" description="Last updated September 2026">
      <div className="space-y-8 rounded-lg border border-border bg-surface p-6 sm:p-8">
        <Section title="1. What this policy covers">
          <p>
            This policy describes how Winfield collects, uses and protects information when a school, its staff, students and
            parents use the Winfield platform (&quot;the Service&quot;). It applies to data submitted directly to us and data
            generated through normal use of the Service.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>We collect information in three ways:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-foreground">Account information</strong> — names, email addresses and roles for staff, parent and student accounts a school creates.</li>
            <li><strong className="text-foreground">School records</strong> — academic, attendance, financial, and communication data a school enters to run its operations, including CBT exam attempts and results.</li>
            <li><strong className="text-foreground">Usage data</strong> — log and device information collected automatically to keep the Service secure and reliable.</li>
          </ul>
        </Section>

        <Section title="3. Who owns school data">
          <p>
            Each school owns the data it enters into the Service. Winfield is multi-tenant by design: one school&apos;s records
            are never visible to another school, and access within a school is controlled by the roles and permissions that
            school&apos;s administrators configure.
          </p>
        </Section>

        <Section title="4. How we use information">
          <p>We use collected information to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Provide, maintain and secure the Service for the school that submitted it.</li>
            <li>Communicate with account holders about their account, billing, and service updates.</li>
            <li>Where a school enables it, power AI-assisted features — always reviewed by a human before anything is finalized.</li>
            <li>Improve the reliability and security of the platform.</li>
          </ul>
        </Section>

        <Section title="5. Data sharing">
          <p>
            We do not sell school or student data. Information is shared only with service providers who help us operate the
            platform (such as payment processors for fee collection, strictly limited to what&apos;s needed to process a
            payment), or when required by law.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            School data is retained for as long as a school&apos;s account is active, and for a reasonable period afterward to
            allow for account recovery, unless a school requests earlier deletion or applicable law requires a different
            retention period.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            Depending on your role and location, you may have rights to access, correct, or request deletion of your personal
            information. School administrators can manage most of this directly from their dashboard; other requests can be
            made through our Contact page.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected by updating the date at the top
            of this page.
          </p>
        </Section>

        <Section title="9. Contact us">
          <p>Questions about this policy can be sent through our Contact page.</p>
        </Section>
      </div>
    </MarketingPageShell>
  );
}

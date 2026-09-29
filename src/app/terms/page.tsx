import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "Terms of Service — Otelum" };

const LAST_UPDATED = "September 29, 2026";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="container-shell max-w-3xl py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

          <div className="prose-content mt-10 space-y-8 text-sm leading-relaxed text-muted">
            <section>
              <h2 className="text-base font-semibold text-foreground">1. Agreement</h2>
              <p className="mt-2">
                These Terms of Service (&quot;Terms&quot;) govern access to and use of Otelum, a hotel management
                platform provided by Numi Innovations LTD (&quot;Numi Innovations&quot;, &quot;we&quot;,
                &quot;us&quot;). By registering a hotel, creating an account, or otherwise using Otelum, you agree to
                these Terms on behalf of yourself and, if applicable, the hotel or organization you represent.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">2. Your account and hotel</h2>
              <p className="mt-2">
                You are responsible for the accuracy of the information you provide, for keeping your login
                credentials confidential, and for all activity that occurs under your account. If you register a
                hotel, you are responsible for the staff accounts you create and the roles and permissions you grant
                them.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">3. Acceptable use</h2>
              <p className="mt-2">You agree not to:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Use Otelum for any unlawful purpose or in violation of any applicable law or regulation.</li>
                <li>Attempt to access another hotel&apos;s data or bypass the platform&apos;s access controls.</li>
                <li>Interfere with or disrupt the integrity or performance of Otelum or its infrastructure.</li>
                <li>Reverse engineer, resell, or white-label the platform without our written permission.</li>
                <li>Upload content that is unlawful, infringing, or that you do not have the right to store.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">4. Your data</h2>
              <p className="mt-2">
                You retain ownership of the reservation, guest, staff and financial data your hotel enters into
                Otelum. You are responsible for the legality of collecting and storing that data (including guest
                personal information) under the laws applicable to your hotel, and for maintaining any consents your
                hotel needs from its own guests and staff.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">5. Service availability</h2>
              <p className="mt-2">
                We aim to keep Otelum available and reliable, but we do not guarantee uninterrupted access. We may
                perform maintenance, and features may change as the platform evolves. We will make reasonable
                efforts to communicate significant changes or planned downtime in advance.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">6. Suspension and termination</h2>
              <p className="mt-2">
                We may suspend or terminate access to an account that violates these Terms, poses a security risk,
                or is used for unlawful activity. You may stop using Otelum and request deletion of your hotel&apos;s
                account at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">7. Disclaimer and limitation of liability</h2>
              <p className="mt-2">
                Otelum is provided &quot;as is&quot;, without warranties of any kind, express or implied. To the
                maximum extent permitted by law, Numi Innovations LTD will not be liable for indirect, incidental,
                or consequential damages arising from your use of the platform. Nothing in these Terms limits any
                liability that cannot be limited under applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">8. Changes to these Terms</h2>
              <p className="mt-2">
                We may update these Terms from time to time. We will update the &quot;Last updated&quot; date above,
                and material changes will be communicated to hotel account owners. Continued use of Otelum after a
                change takes effect constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
              <p className="mt-2">
                Questions about these Terms can be sent to{" "}
                <a href="mailto:hello@otelum.io" className="text-accent hover:underline">
                  hello@otelum.io
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "Privacy Policy — Otelum" };

const LAST_UPDATED = "September 29, 2026";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="container-shell max-w-3xl py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

          <div className="prose-content mt-10 space-y-8 text-sm leading-relaxed text-muted">
            <section>
              <h2 className="text-base font-semibold text-foreground">1. Who we are</h2>
              <p className="mt-2">
                Otelum (&quot;Otelum&quot;, &quot;we&quot;, &quot;us&quot;) is a hotel management platform developed
                and operated by Numi Innovations LTD (&quot;Numi Innovations&quot;, the &quot;Company&quot;). This
                policy explains what information we collect through Otelum, how it is used, and the choices
                available to you.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">2. Two kinds of data</h2>
              <p className="mt-2">
                <strong className="text-foreground">Account data:</strong> information about you and your hotel that
                you provide directly — name, email address, phone number, hotel details and billing contact — which
                we use to operate your account.
              </p>
              <p className="mt-2">
                <strong className="text-foreground">Guest and operational data:</strong> reservation, guest,
                payment and staffing records that your hotel&apos;s staff enter into Otelum in the course of running
                your property. For this data, your hotel is the data controller and Numi Innovations acts as a data
                processor, storing and processing it only on your hotel&apos;s instructions and for the purpose of
                providing the service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">3. How we use information</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>To provide, maintain and secure the Otelum platform for your hotel.</li>
                <li>To authenticate accounts and enforce per-hotel data isolation and role-based access control.</li>
                <li>To send account, security and service-related communications (not marketing, unless you opt in).</li>
                <li>To diagnose technical issues and improve reliability and performance.</li>
                <li>To comply with legal obligations and enforce our Terms of Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">4. Data isolation between hotels</h2>
              <p className="mt-2">
                Otelum is built as a multi-tenant system: every hotel-scoped record is tied to that hotel, and every
                database query is scoped server-side to the authenticated user&apos;s hotel membership. One hotel&apos;s
                staff cannot access another hotel&apos;s reservations, guests, payments or reports through the
                application.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">5. Security</h2>
              <p className="mt-2">
                Passwords are hashed (never stored in plain text), traffic to Otelum is encrypted in transit, and
                access to production data is restricted to what is operationally necessary. No system is perfectly
                secure, and we encourage hotels to use strong, unique passwords and to promptly deactivate accounts
                for staff who leave.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">6. Data retention</h2>
              <p className="mt-2">
                We retain account and operational data for as long as your hotel&apos;s account is active, and for a
                reasonable period afterward to comply with legal, accounting or dispute-resolution obligations. Your
                hotel can request deletion of its data by contacting us, subject to any records we are legally
                required to keep.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">7. Third-party processors</h2>
              <p className="mt-2">
                We use reputable third-party infrastructure providers (such as database hosting and cloud
                application hosting) to operate Otelum. These providers process data only as necessary to deliver
                their service to us and are bound by their own security and confidentiality obligations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">8. Your rights</h2>
              <p className="mt-2">
                Depending on your location, you may have rights to access, correct, export or delete personal
                information we hold about you. To exercise any of these rights, contact us at{" "}
                <a href="mailto:hello@otelum.io" className="text-accent hover:underline">
                  hello@otelum.io
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">9. Changes to this policy</h2>
              <p className="mt-2">
                We may update this policy from time to time. We will update the &quot;Last updated&quot; date above
                when we do, and material changes will be communicated to hotel account owners.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
              <p className="mt-2">
                Questions about this policy or your data can be sent to{" "}
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

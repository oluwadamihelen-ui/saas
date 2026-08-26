import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LegalDisclaimer, LegalSection } from "@/components/LegalContent";

export const metadata = { title: "Privacy Policy — FilmDoe" };

const LAST_UPDATED = "August 23, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 md:px-8">
        <span className="eyebrow">Legal</span>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-cinerra-muted">Last updated: {LAST_UPDATED}</p>

        <LegalDisclaimer />

        <div className="mt-8 flex flex-col gap-8">
          <LegalSection title="1. What this covers">
            <p>
              This Privacy Policy explains what information FilmDoe collects, how we use it, and the choices you have. It
              applies to your account, the content you generate, and your use of the site.
            </p>
          </LegalSection>

          <LegalSection title="2. Information we collect">
            <ul className="list-disc pl-5">
              <li>
                <span className="text-cinerra-text">Account information:</span> name, email address, and password
                (stored as a salted hash, never in plain text) — or, if you sign in with Google, the profile information
                Google shares with us.
              </li>
              <li>
                <span className="text-cinerra-text">Content you create:</span> prompts, story text, uploaded source
                documents, and the characters, images, video, audio, and exports FilmDoe generates for you.
              </li>
              <li>
                <span className="text-cinerra-text">Billing information:</span> if you subscribe to a paid plan or buy
                Doe, payment details are collected and processed directly by Paystack and/or Korapay (your choice,
                where both are offered) — we don&rsquo;t receive or store your card number.
              </li>
              <li>
                <span className="text-cinerra-text">Usage data:</span> basic technical data needed to operate the
                service, such as sign-in sessions and generation job history. We do not currently use third-party
                analytics or advertising trackers.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="3. How we use your information">
            <ul className="list-disc pl-5">
              <li>To provide the service — creating your account, running generations, and assembling exports.</li>
              <li>To process payments and manage subscriptions through Paystack and/or Korapay.</li>
              <li>To send you service-related messages, such as generation status or account notices.</li>
              <li>To maintain the security and integrity of the platform, including enforcing our Terms of Service.</li>
            </ul>
          </LegalSection>

          <LegalSection title="4. Sharing with third-party providers">
            <p>
              To generate content, the prompts and material you submit are sent to the AI provider(s) configured for
              your workspace — currently drawn from Anthropic (story/script text), OpenAI (images), Runway (video), and
              ElevenLabs (voice, sound effects, and music) — solely to produce your requested output. Generated files are
              stored with our object storage provider. Payments are processed by Paystack and/or Korapay. We
              don&rsquo;t sell your personal information to anyone.
            </p>
          </LegalSection>

          <LegalSection title="5. Publishing and public content">
            <p>
              If you choose to publish a project, its title, poster, and video become visible to anyone who visits its
              public watch page or the Discover feed, including people who aren&rsquo;t signed in. Your display name is
              shown as the creator. Unpublishing removes it from Discover and the public watch page.
            </p>
          </LegalSection>

          <LegalSection title="6. Cookies">
            <p>
              We use a session cookie to keep you signed in. We don&rsquo;t use third-party advertising or tracking
              cookies.
            </p>
          </LegalSection>

          <LegalSection title="7. Data retention and deletion">
            <p>
              We keep your account and content for as long as your account is active. To request deletion of your
              account and associated data, contact us at{" "}
              <a href="mailto:privacy@filmdoe.app" className="text-cinerra-accent underline">
                privacy@filmdoe.app
              </a>
              . We may retain limited information where required for legal, billing, or security purposes.
            </p>
          </LegalSection>

          <LegalSection title="8. Your rights">
            <p>
              Depending on where you live, you may have rights to access, correct, export, or delete your personal
              information, or to object to certain processing. To exercise any of these, contact us at the address
              above.
            </p>
          </LegalSection>

          <LegalSection title="9. Children's privacy">
            <p>FilmDoe is not directed at children under 18, and we don&rsquo;t knowingly collect data from them.</p>
          </LegalSection>

          <LegalSection title="10. Security">
            <p>
              We use reasonable technical and organizational measures to protect your information, including hashed
              passwords and time-limited signed URLs for generated assets. No method of transmission or storage is
              perfectly secure, and we can&rsquo;t guarantee absolute security.
            </p>
          </LegalSection>

          <LegalSection title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes, we&rsquo;ll update the &ldquo;Last
              updated&rdquo; date above.
            </p>
          </LegalSection>

          <LegalSection title="12. Contact">
            <p>
              Questions about this policy? Reach us at{" "}
              <a href="mailto:privacy@filmdoe.app" className="text-cinerra-accent underline">
                privacy@filmdoe.app
              </a>
              .
            </p>
          </LegalSection>
        </div>
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}

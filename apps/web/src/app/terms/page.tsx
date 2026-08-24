import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LegalDisclaimer, LegalSection } from "@/components/LegalContent";

export const metadata = { title: "Terms of Service — Cinerra" };

const LAST_UPDATED = "August 23, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 md:px-8">
        <span className="eyebrow">Legal</span>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-cinerra-muted">Last updated: {LAST_UPDATED}</p>

        <LegalDisclaimer />

        <div className="mt-8 flex flex-col gap-8">
          <LegalSection title="1. Agreement to these terms">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Cinerra (&ldquo;Cinerra,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;), an AI-assisted movie and episodic-drama generation platform. By creating an
              account or using Cinerra, you agree to these Terms and to our{" "}
              <a href="/privacy" className="text-cinerra-accent underline">
                Privacy Policy
              </a>
              . If you don&rsquo;t agree, don&rsquo;t use the service.
            </p>
          </LegalSection>

          <LegalSection title="2. Eligibility">
            <p>
              You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account. By
              signing up, you represent that you meet this requirement and that the information you provide is accurate.
            </p>
          </LegalSection>

          <LegalSection title="3. What Cinerra does">
            <p>
              Cinerra lets you generate story, character, location, storyboard, video, dialogue, sound effect, and music
              content using third-party AI providers (currently including Anthropic, OpenAI, Runway, and ElevenLabs,
              depending on what your workspace has configured). Prompts, story text, and reference material you submit for
              generation are sent to those providers solely to produce your requested output — see our{" "}
              <a href="/privacy" className="text-cinerra-accent underline">
                Privacy Policy
              </a>{" "}
              for how that data is handled. We don&rsquo;t control those providers&rsquo; models and don&rsquo;t guarantee
              any particular output, accuracy, or quality.
            </p>
          </LegalSection>

          <LegalSection title="4. Your content">
            <p>
              You keep ownership of the story ideas, prompts, and source material you submit, and of the movies and assets
              Cinerra generates for you (&ldquo;Your Content&rdquo;), subject to any rights third parties may have in
              material you upload or reference. You grant Cinerra a limited license to host, store, process, and — only
              where you choose to publish it — publicly display Your Content in order to operate the service, including
              features like the Discover feed and public watch pages.
            </p>
            <p>
              You&rsquo;re responsible for Your Content and for having the rights to any source material (books, scripts,
              images, etc.) you submit for adaptation. Don&rsquo;t submit anything you don&rsquo;t have the right to use.
            </p>
          </LegalSection>

          <LegalSection title="5. Publishing and Discover">
            <p>
              Publishing a project makes it visible to other users on the public Discover feed and at its own public watch
              page, without requiring viewers to sign in. You choose when to publish, and you can unpublish at any time,
              which removes it from Discover (it does not delete the underlying project). We reserve the right to remove
              published content, or restrict an account, that violates these Terms — including the prohibited-use rules
              below — whether or not it has already been reviewed.
            </p>
          </LegalSection>

          <LegalSection title="6. Prohibited use">
            <p>You agree not to use Cinerra to generate, publish, or upload content that:</p>
            <ul className="list-disc pl-5">
              <li>Is illegal, or depicts or facilitates illegal acts;</li>
              <li>Sexualizes minors in any form, real or fictional;</li>
              <li>Infringes someone else&rsquo;s copyright, trademark, or other intellectual property rights;</li>
              <li>Impersonates a real person without their consent in a misleading or harmful way;</li>
              <li>Is intended to harass, defame, or incite violence against any individual or group; or</li>
              <li>Attempts to circumvent the platform&rsquo;s fair-use limits, security, or generation safeguards.</li>
            </ul>
            <p>We may suspend or terminate accounts that violate this section, with or without notice.</p>
          </LegalSection>

          <LegalSection title="7. Subscriptions and billing">
            <p>
              Paid plans are billed through Paystack on a recurring basis (monthly or yearly, as selected) until cancelled.
              Each plan defines a fair-use concurrency limit — how many generations can run for your account at once —
              rather than a consumable credit balance. You can cancel anytime from your account settings; cancellation takes
              effect at the end of the current billing period. Fees are non-refundable except where required by law.
            </p>
          </LegalSection>

          <LegalSection title="8. Disclaimers">
            <p>
              Cinerra is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind,
              express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
              AI-generated output can be inaccurate, unexpected, or unsuitable for your intended use — review it before
              relying on or distributing it.
            </p>
          </LegalSection>

          <LegalSection title="9. Limitation of liability">
            <p>
              To the maximum extent permitted by law, Cinerra and its affiliates won&rsquo;t be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of data, revenue, or profits, arising
              from your use of the service.
            </p>
          </LegalSection>

          <LegalSection title="10. Termination">
            <p>
              You may stop using Cinerra and delete your account at any time by contacting us. We may suspend or terminate
              your access if you violate these Terms. Sections that by their nature should survive termination (ownership,
              disclaimers, limitation of liability) will survive.
            </p>
          </LegalSection>

          <LegalSection title="11. Changes to these terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we&rsquo;ll update the &ldquo;Last
              updated&rdquo; date above. Continued use of Cinerra after a change means you accept the updated Terms.
            </p>
          </LegalSection>

          <LegalSection title="12. Contact">
            <p>
              Questions about these Terms? Reach us at{" "}
              <a href="mailto:legal@cinerra.app" className="text-cinerra-accent underline">
                legal@cinerra.app
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

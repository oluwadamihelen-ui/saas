import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "Contact — Otelum" };

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="container-shell flex h-16 items-center justify-between">
          <Link href="/">
            <Logo height={30} />
          </Link>
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Register your hotel</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container-shell flex flex-col items-center gap-6 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
            <Mail className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Get in touch</h1>
          <p className="max-w-md text-base text-muted">
            Questions about Otelum, a partnership inquiry, or need help with your account? Email us and we&apos;ll
            get back to you.
          </p>
          <Button asChild size="lg">
            <a href="mailto:hello@otelum.io">hello@otelum.io</a>
          </Button>
          <p className="text-sm text-muted">
            Already have an account and need help with your hotel&apos;s data?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            and reach your Super Admin, or email us directly.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

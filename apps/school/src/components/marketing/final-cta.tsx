import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-foreground py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent)_0%,_transparent_60%)] opacity-20"
      />
      <div className="container-shell relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to run your school smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            Bring your students, staff, academics and administration together with Winfield.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/register">Get started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

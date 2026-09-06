import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="bg-accent py-16">
      <div className="container-shell flex flex-col items-center gap-6 text-center">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-accent-foreground">
          Ready to launch your next application?
        </h2>
        <p className="max-w-lg text-accent-foreground/80">
          Explore the marketplace or talk to us about a custom build — either way, we handle the deployment.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/apps">Explore Applications</Link>
          </Button>
          <Button asChild size="lg" className="bg-accent-foreground text-accent hover:bg-accent-foreground/90">
            <Link href="/contact">Talk to Sales</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

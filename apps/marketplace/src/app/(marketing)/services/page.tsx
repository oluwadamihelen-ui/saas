import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ServicesGrid } from "@/components/marketing/services-grid";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <div>
      <div className="border-b border-border bg-surface py-16">
        <div className="container-shell text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Services</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Beyond software: deployment, customization, infrastructure, and ongoing support — all delivered as one
            managed service.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/contact">Request a Quote</Link>
            </Button>
          </div>
        </div>
      </div>
      <ServicesGrid />
    </div>
  );
}

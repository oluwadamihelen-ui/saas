import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Get in touch</h1>
        <p className="mt-4 text-muted-foreground">
          Questions about Storyloom, a bug to report, or interested in a plan for your team? Send us a message.
        </p>
      </div>
      <Card className="mt-10 p-6 sm:p-8">
        <ContactForm />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { Mail, MessageCircle, PhoneCall } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container-shell py-14">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contact Us</h1>
          <p className="mt-3 max-w-md text-muted">
            Have a project in mind, or need a custom solution? Reach out and our team will follow up within one
            business day.
          </p>
          <div className="mt-8 space-y-5">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-5 w-5 text-accent" /> sales@forgecart.example
            </div>
            <div className="flex items-center gap-3 text-sm">
              <PhoneCall className="h-5 w-5 text-accent" /> +1 (555) 010-0199
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MessageCircle className="h-5 w-5 text-accent" /> Live chat from your dashboard once signed in
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-8">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}

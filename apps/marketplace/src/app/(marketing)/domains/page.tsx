import type { Metadata } from "next";
import { DomainSearchBox } from "@/components/marketing/domain-search-box";

export const metadata: Metadata = { title: "Domains" };

const TLDS = [
  { tld: ".com", price: "$12.99/yr" },
  { tld: ".ng", price: "$18.00/yr" },
  { tld: ".org", price: "$13.99/yr" },
  { tld: ".net", price: "$13.49/yr" },
  { tld: ".co", price: "$27.99/yr" },
  { tld: ".io", price: "$44.99/yr" },
  { tld: ".app", price: "$16.99/yr" },
];

export default function DomainsPage() {
  return (
    <div className="container-shell py-14">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Find and register your domain</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Search availability, compare pricing, and register your domain alongside your application deployment.
        </p>
      </div>
      <div className="mt-10">
        <DomainSearchBox />
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-lg font-semibold">Popular Extensions</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TLDS.map((t) => (
            <div key={t.tld} className="rounded-lg border border-border bg-surface p-4 text-center">
              <p className="text-lg font-semibold text-foreground">{t.tld}</p>
              <p className="text-xs text-muted">{t.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

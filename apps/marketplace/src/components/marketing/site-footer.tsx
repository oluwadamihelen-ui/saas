import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const FOOTER_LINKS = {
  Product: [
    { href: "/apps", label: "Applications" },
    { href: "/categories", label: "Categories" },
    { href: "/pricing", label: "Pricing" },
    { href: "/services", label: "Services" },
  ],
  Infrastructure: [
    { href: "/domains", label: "Domains" },
    { href: "/hosting", label: "Hosting" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/legal/terms", label: "Terms of Service" },
    { href: "/legal/privacy", label: "Privacy Policy" },
    { href: "/legal/refunds", label: "Refund Policy" },
    { href: "/legal/acceptable-use", label: "Acceptable Use" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-shell grid grid-cols-2 gap-8 py-14 md:grid-cols-5">
        <div className="col-span-2 space-y-3">
          <Logo height={28} />
          <p className="max-w-xs text-sm text-muted">
            Ready-to-launch software, deployment and infrastructure — delivered as one managed service.
          </p>
        </div>

        {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
          <div key={heading}>
            <p className="text-sm font-semibold text-foreground">{heading}</p>
            <ul className="mt-3 space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6">
        <p className="container-shell text-xs text-muted">
          © {new Date().getFullYear()} BridgeCodes, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

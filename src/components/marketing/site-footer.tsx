import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Solutions", href: "#why-schoolum" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Documentation", href: "/docs" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy">
      <div className="container-shell grid grid-cols-2 gap-10 py-14 sm:grid-cols-3 lg:grid-cols-6 lg:py-16">
        <div className="col-span-2 lg:col-span-2">
          <Logo height={28} variant="light" />
          <p className="mt-4 max-w-xs text-sm text-white/60">Modern school management made simple.</p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold text-white">{column.title}</p>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/60 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-shell flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Schoolum. All rights reserved.</p>
          <p>Built for schools across Africa.</p>
        </div>
      </div>
    </footer>
  );
}

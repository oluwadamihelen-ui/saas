import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-shell flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo height={28} />
          </Link>
          <p className="text-sm text-muted">Secure Checkout</p>
        </div>
      </header>
      {children}
    </div>
  );
}

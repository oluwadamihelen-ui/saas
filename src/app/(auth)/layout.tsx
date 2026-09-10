import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(60rem 40rem at -10% -10%, var(--accent) 0%, transparent 55%), radial-gradient(50rem 36rem at 110% 110%, var(--secondary) 0%, transparent 55%)",
          }}
        />
        <Link href="/" className="relative z-10 flex items-center">
          <Logo height={30} variant="light" />
        </Link>
        <div className="relative z-10 max-w-md space-y-4">
          <p className="text-3xl font-semibold leading-tight tracking-tight">{brand.tagline}</p>
          <p className="text-white/70">{brand.description}</p>
        </div>
        <p className="relative z-10 text-xs text-white/50">© {new Date().getFullYear()} {brand.legalName}. All rights reserved.</p>
      </div>
      <div className="flex flex-col items-center justify-center bg-background px-4 py-12">
        <Link href="/" className="mb-8 flex items-center lg:hidden">
          <Logo height={32} />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

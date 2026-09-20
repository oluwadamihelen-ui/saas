import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-shell flex items-center justify-between py-4">
          <Link href="/"><Logo height={28} /></Link>
        </div>
      </header>
      <main className="container-shell max-w-2xl py-12">{children}</main>
    </div>
  );
}

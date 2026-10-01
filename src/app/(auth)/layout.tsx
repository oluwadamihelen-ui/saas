import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 self-center"><Logo className="text-lg" /></Link>
      {children}
      <p className="mt-8 text-center text-xs text-muted">Calculations and record-keeping, not financial advice. Trading leveraged products involves substantial risk.</p>
    </main>
  );
}

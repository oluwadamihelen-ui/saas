import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
          F
        </span>
        <span className="text-lg font-semibold tracking-tight">Forgecart</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

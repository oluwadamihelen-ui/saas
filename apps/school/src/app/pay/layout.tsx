import { Logo } from "@/components/brand/logo";

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-shell py-4"><Logo height={28} /></div>
      </header>
      <main className="container-shell max-w-xl py-12">{children}</main>
    </div>
  );
}

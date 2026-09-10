export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container-shell max-w-xl py-12">{children}</main>
    </div>
  );
}

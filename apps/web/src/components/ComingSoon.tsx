import { Header } from "./Header";
import { MobileNav } from "./Nav";
import { EmptyState } from "./EmptyState";

export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 md:px-8">
        <EmptyState title={title} description={description} />
      </main>
      <MobileNav />
    </div>
  );
}

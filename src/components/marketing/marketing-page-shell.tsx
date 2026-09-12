import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export function MarketingPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="container-shell py-14 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 space-y-3 text-center">
              {eyebrow && (
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted shadow-sm">
                  {eyebrow}
                </span>
              )}
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
              {description && <p className="mx-auto max-w-xl text-lg text-muted">{description}</p>}
            </div>
            <div className="space-y-8">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

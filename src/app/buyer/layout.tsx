import { requireBuyer } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "./sign-out-button";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireBuyer();
  const buyer = await prisma.buyer.findUnique({ where: { userId: sessionUser.id }, include: { user: true } });
  if (!buyer) throw new Error("Buyer profile not found.");

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <Logo height={26} />
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-foreground">{buyer.displayName}</p>
            <p className="text-xs text-muted">Buyer · {buyer.user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="container-shell py-6 sm:py-8">{children}</main>
    </div>
  );
}

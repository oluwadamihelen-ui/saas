import { signOut } from "@/auth";
import { AccountSwitcher, MobileBar, Sidebar } from "@/components/nav";
import { Button } from "@/components/ui";
import { getContext } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { account, accounts, plan, user } = await getContext();
  return (
    <div className="flex min-h-dvh">
      <Sidebar plan={plan.key} />
      <div className="min-w-0 flex-1">
        <MobileBar />
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:px-8">
          <AccountSwitcher accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} activeId={account.id} />
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><Button variant="ghost" size="sm">Log out</Button></form>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 lg:pb-12">{children}</main>
      </div>
    </div>
  );
}

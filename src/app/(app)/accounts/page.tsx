import type { Metadata } from "next";
import { Badge, Button, Card, CardHeader, PageHeader, UpgradeNote } from "@/components/ui";
import { AccountForm } from "@/components/account-form";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { archiveAccountAction } from "@/actions/account";
import { currentBalance } from "@/lib/data";
import { money } from "@/lib/utils";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { user, accounts, account: active, plan } = await getContext();
  const rows = await Promise.all(accounts.map(async (a) => {
    const trades = await prisma.trade.findMany({ where: { userId: user.id, accountId: a.id }, select: { pnl: true } });
    return { a, balance: currentBalance(a.startingBalance, trades), count: trades.length };
  }));
  const canAdd = accounts.length < plan.limits.maxAccounts;
  return (
    <>
      <PageHeader title="Trading accounts" subtitle="Each account has its own balance, rules, trades and analytics." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ a, balance, count }) => (
          <Card key={a.id} className={a.id === active.id ? "border-accent/60" : ""}>
            <CardHeader title={<>{a.name} {a.id === active.id && <Badge tone="accent">Active</Badge>}</>} action={accounts.length > 1 ? <form action={async () => { "use server"; await archiveAccountAction(a.id); }}><Button variant="ghost" size="sm">Archive</Button></form> : undefined} />
            <div className="p-4"><div className="num text-2xl font-semibold">{money(balance, a.currency)}</div><p className="mt-1 text-xs text-muted">{a.broker || a.platform} · {a.currency} · {count} trades · max daily loss {a.riskSettings?.maxDailyLossPercent}%</p></div>
            <details className="border-t border-line"><summary className="cursor-pointer px-4 py-2.5 text-sm text-muted">Edit account</summary><div className="p-4"><AccountForm account={a} submitLabel="Save" /></div></details>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-lg font-semibold">Add an account</h2>
      {canAdd ? <Card className="p-5"><AccountForm submitLabel="Create account" /></Card> : <UpgradeNote feature="The Free plan includes one account. Pro supports several (e.g. FTMO, Deriv, Exness, Binance)." />}
    </>
  );
}

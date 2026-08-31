import { getCurrentBusiness } from "@/lib/current-business";
import { getOrCreateWallet, isWalletModeBusiness } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { WalletClient } from "@/components/dashboard/wallet/wallet-client";

export default async function WalletPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const [wallet, walletMode, bankAccount, transactions] = await Promise.all([
    getOrCreateWallet(business.id),
    isWalletModeBusiness(business.id),
    prisma.bankAccount.findUnique({ where: { businessId: business.id } }),
    prisma.walletTransaction.findMany({
      where: { wallet: { businessId: business.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {walletMode
            ? "Your sales are collected on MAMA's platform account and tracked here as your balance."
            : "You've connected your own Paystack account, so sales settle directly to your bank — this wallet is only used if you're paid by another merchant's wallet."}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground">Available balance</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(wallet.balance.toString(), wallet.currency)}</p>
        </CardContent>
      </Card>

      <WalletClient
        businessId={business.id}
        currency={business.currency}
        initialBankAccount={JSON.parse(JSON.stringify(bankAccount))}
        initialTransactions={JSON.parse(JSON.stringify(transactions))}
        balance={wallet.balance.toString()}
      />
    </div>
  );
}

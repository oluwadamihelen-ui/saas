"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Landmark, Wallet as WalletIcon, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type BankAccount = {
  accountNumber: string;
  bankName: string | null;
  accountName: string;
  isVerified: boolean;
} | null;

type WalletTransaction = {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

const CREDIT_TYPES = new Set(["SALE_CREDIT", "WITHDRAWAL_REVERSAL", "WALLET_PURCHASE_CREDIT"]);

export function WalletClient({
  businessId,
  currency,
  initialBankAccount,
  initialTransactions,
  balance,
}: {
  businessId: string;
  currency: string;
  initialBankAccount: BankAccount;
  initialTransactions: WalletTransaction[];
  balance: string;
}) {
  const router = useRouter();
  const [bankAccount, setBankAccount] = useState(initialBankAccount);
  const [transactions] = useState(initialTransactions);
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [bankForm, setBankForm] = useState({ bankCode: "", accountNumber: "" });
  const [verifying, setVerifying] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetch("/api/wallet/banks")
      .then((res) => res.json())
      .then((data) => setBanks(data.banks ?? []))
      .catch(() => undefined);
  }, []);

  async function saveBankAccount() {
    setVerifying(true);
    try {
      const res = await fetch("/api/wallet/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...bankForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not verify that account");
        return;
      }
      setBankAccount(data.bankAccount);
      setEditingBank(false);
      toast.success(`Verified — ${data.bankAccount.accountName}`);
    } finally {
      setVerifying(false);
    }
  }

  async function requestWithdrawal() {
    setWithdrawing(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not request withdrawal");
        return;
      }
      toast.success("Withdrawal requested — you'll be notified once it's paid out");
      setWithdrawOpen(false);
      setAmount("");
      router.refresh();
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Landmark className="h-4 w-4" /> Payout bank account
            </h2>
            {bankAccount?.isVerified && <Badge variant="success">Verified</Badge>}
          </div>

          {bankAccount?.isVerified && !editingBank ? (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/50 p-4">
              <div>
                <p className="font-medium">{bankAccount.accountName}</p>
                <p className="text-sm text-muted-foreground">
                  {bankAccount.bankName ?? "Bank"} — {bankAccount.accountNumber}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingBank(true)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bank</Label>
                <Select value={bankForm.bankCode} onValueChange={(v) => setBankForm({ ...bankForm, bankCode: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account number</Label>
                <Input
                  value={bankForm.accountNumber}
                  maxLength={10}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, "") })}
                  placeholder="0123456789"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={saveBankAccount}
                  disabled={verifying || !bankForm.bankCode || bankForm.accountNumber.length !== 10}
                >
                  {verifying ? "Verifying…" : "Verify & save"}
                </Button>
                {editingBank && (
                  <Button variant="ghost" className="ml-2" onClick={() => setEditingBank(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            No Paystack account needed here — we verify the account number directly and pay out on your behalf.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <WalletIcon className="h-4 w-4" /> Transaction history
        </h2>
        <Button onClick={() => setWithdrawOpen(true)} disabled={!bankAccount?.isVerified}>
          <ArrowDownToLine className="h-4 w-4" /> Withdraw
        </Button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={WalletIcon} title="No wallet activity yet." description="Sales collected through your MAMA wallet will show up here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance after</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const isCredit = CREDIT_TYPES.has(t.type);
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge variant="outline">{t.type.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className={isCredit ? "text-emerald-600" : "text-red-600"}>
                    {isCredit ? "+" : "-"}
                    {formatCurrency(t.amount, currency)}
                  </TableCell>
                  <TableCell>{formatCurrency(t.balanceAfter, currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to your bank account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Available balance: <span className="font-medium text-foreground">{formatCurrency(balance, currency)}</span>
            </p>
            <div className="space-y-2">
              <Label>Amount ({currency})</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={requestWithdrawal} disabled={withdrawing || !amount || Number(amount) <= 0}>
              {withdrawing ? "Requesting…" : "Request withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Landmark, Wallet as WalletIcon, ArrowDownToLine, ShieldAlert, Lock, ShieldQuestion } from "lucide-react";
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
  lockedUntil: string | null;
} | null;

type ChangeRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  accountNumber: string;
  bankName: string | null;
  reviewNote: string | null;
  createdAt: string;
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
const EMPTY_BANK_FORM = { bankCode: "", accountNumber: "", currentPassword: "", reason: "" };

export function WalletClient({
  businessId,
  currency,
  initialBankAccount,
  initialTransactions,
  latestChangeRequest,
  securityQuestions,
  balance,
}: {
  businessId: string;
  currency: string;
  initialBankAccount: BankAccount;
  initialTransactions: WalletTransaction[];
  latestChangeRequest: ChangeRequest;
  securityQuestions: string[];
  balance: string;
}) {
  const router = useRouter();
  const [bankAccount, setBankAccount] = useState(initialBankAccount);
  const [changeRequest, setChangeRequest] = useState(latestChangeRequest);
  const [transactions] = useState(initialTransactions);
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [bankForm, setBankForm] = useState({ ...EMPTY_BANK_FORM });
  const [securityAnswers, setSecurityAnswers] = useState(securityQuestions.map(() => ""));
  const [verifying, setVerifying] = useState(false);
  const [nameMismatchWarning, setNameMismatchWarning] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const isLocked = Boolean(bankAccount?.lockedUntil && new Date(bankAccount.lockedUntil) > new Date());
  const hasPendingRequest = changeRequest?.status === "PENDING";

  useEffect(() => {
    fetch("/api/wallet/banks")
      .then((res) => res.json())
      .then((data) => setBanks(data.banks ?? []))
      .catch(() => undefined);
  }, []);

  async function addBankAccount() {
    setVerifying(true);
    setNameMismatchWarning(null);
    try {
      const res = await fetch("/api/wallet/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...bankForm, securityAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not verify that account");
        return;
      }
      setBankAccount(data.bankAccount);
      setBankForm({ ...EMPTY_BANK_FORM });
      setSecurityAnswers(securityQuestions.map(() => ""));
      toast.success(`Verified — ${data.bankAccount.accountName}`);
      if (data.nameMismatch) {
        setNameMismatchWarning(
          `This account is registered to "${data.bankAccount.accountName}", which doesn't match your business owner name. Double check this is really your account.`
        );
      }
    } finally {
      setVerifying(false);
    }
  }

  async function submitChangeRequest() {
    setVerifying(true);
    try {
      const res = await fetch("/api/wallet/bank-account/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...bankForm, securityAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not submit that change request");
        return;
      }
      setChangeRequest(data.changeRequest);
      setBankForm({ ...EMPTY_BANK_FORM });
      setSecurityAnswers(securityQuestions.map(() => ""));
      setChangeOpen(false);
      toast.success("Change request submitted — our team will review and contact you before it takes effect");
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
        body: JSON.stringify({ businessId, amount: Number(amount), currentPassword: withdrawPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not request withdrawal");
        return;
      }
      toast.success("Withdrawal requested — you'll be notified once it's paid out");
      setWithdrawOpen(false);
      setAmount("");
      setWithdrawPassword("");
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
            <div className="flex gap-2">
              {isLocked && (
                <Badge variant="warning">
                  <Lock className="h-3 w-3" /> Withdrawals locked
                </Badge>
              )}
              {bankAccount?.isVerified && <Badge variant="success">Verified</Badge>}
            </div>
          </div>

          {nameMismatchWarning && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{nameMismatchWarning}</p>
            </div>
          )}

          {isLocked && bankAccount?.lockedUntil && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-700">
              <Lock className="h-3 w-3" /> Withdrawals are locked until {new Date(bankAccount.lockedUntil).toLocaleString()} since this account was just added or changed — this window lets you catch a change that wasn&apos;t yours.
            </p>
          )}

          {hasPendingRequest && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                A request to change this account to {changeRequest?.bankName ?? "a new bank"} — {changeRequest?.accountNumber} is
                pending review. Our team will contact you to confirm before it takes effect.
              </p>
            </div>
          )}

          {!hasPendingRequest && changeRequest?.status === "REJECTED" && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Your last change request was declined{changeRequest?.reviewNote ? `: ${changeRequest.reviewNote}` : "."}</p>
            </div>
          )}

          {bankAccount?.isVerified ? (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/50 p-4">
              <div>
                <p className="font-medium">{bankAccount.accountName}</p>
                <p className="text-sm text-muted-foreground">
                  {bankAccount.bankName ?? "Bank"} — {bankAccount.accountNumber}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setChangeOpen(true)} disabled={hasPendingRequest}>
                Request a change
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
              <div className="space-y-3 sm:col-span-2 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldQuestion className="h-3.5 w-3.5" /> Set up security questions — you&apos;ll need these to ever change this account later
                </p>
                {securityQuestions.map((q, i) => (
                  <div key={q} className="space-y-1">
                    <Label className="text-xs font-normal text-muted-foreground">{q}</Label>
                    <Input
                      value={securityAnswers[i]}
                      onChange={(e) => {
                        const next = [...securityAnswers];
                        next[i] = e.target.value;
                        setSecurityAnswers(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Confirm your password</Label>
                <Input
                  type="password"
                  value={bankForm.currentPassword}
                  onChange={(e) => setBankForm({ ...bankForm, currentPassword: e.target.value })}
                  placeholder="Required to add a payout account"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={addBankAccount}
                  disabled={
                    verifying ||
                    !bankForm.bankCode ||
                    bankForm.accountNumber.length !== 10 ||
                    !bankForm.currentPassword ||
                    securityAnswers.some((a) => !a.trim())
                  }
                >
                  {verifying ? "Verifying…" : "Verify & save"}
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            No Paystack account needed here — we verify the account number directly and pay out on your behalf. Only
            the business owner can set this up, and once saved it can&apos;t be edited or removed from the dashboard —
            any change goes through a reviewed request that needs your password and security question answers, and
            only takes effect once our support team approves it.
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
            <div className="space-y-2">
              <Label>Confirm your password</Label>
              <Input
                type="password"
                value={withdrawPassword}
                onChange={(e) => setWithdrawPassword(e.target.value)}
                placeholder="Required to request a withdrawal"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              onClick={requestWithdrawal}
              disabled={withdrawing || !amount || Number(amount) <= 0 || !withdrawPassword}
            >
              {withdrawing ? "Requesting…" : "Request withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a payout account change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This doesn&apos;t change anything immediately — it submits a request that our support team reviews
              (and will contact you about) before it takes effect.
            </p>
            <div className="space-y-2">
              <Label>New bank</Label>
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
              <Label>New account number</Label>
              <Input
                value={bankForm.accountNumber}
                maxLength={10}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, "") })}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for the change</Label>
              <Input
                value={bankForm.reason}
                onChange={(e) => setBankForm({ ...bankForm, reason: e.target.value })}
                placeholder="e.g. old account was closed"
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShieldQuestion className="h-3.5 w-3.5" /> Answer your security questions to confirm it&apos;s really you
              </p>
              {securityQuestions.map((q, i) => (
                <div key={q} className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">{q}</Label>
                  <Input
                    value={securityAnswers[i]}
                    onChange={(e) => {
                      const next = [...securityAnswers];
                      next[i] = e.target.value;
                      setSecurityAnswers(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Confirm your password</Label>
              <Input
                type="password"
                value={bankForm.currentPassword}
                onChange={(e) => setBankForm({ ...bankForm, currentPassword: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button
              onClick={submitChangeRequest}
              disabled={
                verifying ||
                !bankForm.bankCode ||
                bankForm.accountNumber.length !== 10 ||
                !bankForm.currentPassword ||
                securityAnswers.some((a) => !a.trim())
              }
            >
              {verifying ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

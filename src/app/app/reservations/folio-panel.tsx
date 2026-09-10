"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { addChargeAction, removeChargeAction, recordPaymentAction } from "./actions";
import type { ChargeType, PaymentMethod } from "@/generated/prisma/enums";

const CHARGE_TYPES: ChargeType[] = ["LAUNDRY", "ROOM_SERVICE", "RESTAURANT", "BAR", "MINI_BAR", "EXTRA_BED", "AIRPORT_PICKUP", "LATE_CHECKOUT", "OTHER"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "POS", "ONLINE_PAYMENT", "PAYMENT_LINK", "OTHER"];

export function FolioPanel({
  reservationId,
  guestId,
  canManage,
  canPay,
  charges,
  canEditCharges,
}: {
  reservationId: string;
  guestId: string;
  canManage: boolean;
  canPay: boolean;
  canEditCharges: boolean;
  charges: { id: string; description: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [chargeType, setChargeType] = useState<ChargeType>("ROOM_SERVICE");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payNotes, setPayNotes] = useState("");

  function run(fn: () => Promise<void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onSuccess?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium text-foreground">Add a charge</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={chargeType} onChange={(e) => setChargeType(e.target.value as ChargeType)} className="w-44">
                {CHARGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} className="w-56" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} className="w-32" />
            </div>
            <Button
              size="sm"
              disabled={isPending || !chargeAmount}
              onClick={() =>
                run(() => addChargeAction(reservationId, chargeType, chargeDescription, Number(chargeAmount)), () => {
                  setChargeDescription("");
                  setChargeAmount("");
                })
              }
            >
              Add Charge
            </Button>
          </div>
          {canEditCharges && charges.length > 0 && (
            <ul className="mt-2 space-y-1">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs text-muted">
                  {c.description}
                  <button type="button" disabled={isPending} onClick={() => run(() => removeChargeAction(reservationId, c.id))} className="text-danger hover:underline">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canPay && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium text-foreground">Record a payment</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-32" />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="w-44">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-56" />
            </div>
            <Button
              size="sm"
              disabled={isPending || !payAmount}
              onClick={() =>
                run(() => recordPaymentAction(reservationId, guestId, Number(payAmount), payMethod, payNotes), () => {
                  setPayAmount("");
                  setPayNotes("");
                })
              }
            >
              Record Payment
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

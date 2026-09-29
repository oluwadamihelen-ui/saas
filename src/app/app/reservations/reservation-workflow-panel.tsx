"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  confirmReservationAction,
  cancelReservationAction,
  markNoShowAction,
  extendStayAction,
  transferRoomAction,
  checkInAction,
  checkOutAction,
} from "./actions";
import type { PaymentMethod, ReservationStatus } from "@/generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "POS", "ONLINE_PAYMENT", "PAYMENT_LINK", "OTHER"];

export function ReservationWorkflowPanel({
  reservationId,
  status,
  balance,
  currentRoomId,
  availableRooms,
}: {
  reservationId: string;
  status: ReservationStatus;
  balance: number;
  currentRoomId: string;
  availableRooms: { id: string; roomNumber: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "cancel" | "extend" | "transfer" | "checkout">("none");

  const [cancelReason, setCancelReason] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [transferRoomId, setTransferRoomId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [payAmount, setPayAmount] = useState(String(balance > 0 ? balance : ""));
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [allowOutstanding, setAllowOutstanding] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setMode("none");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => confirmReservationAction(reservationId))}>
            Confirm
          </Button>
        )}
        {(status === "PENDING" || status === "CONFIRMED") && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => checkInAction(reservationId))}>
            Check In
          </Button>
        )}
        {status === "CHECKED_IN" && (
          <Button size="sm" disabled={isPending} onClick={() => setMode(mode === "checkout" ? "none" : "checkout")}>
            Check Out
          </Button>
        )}
        {(status === "CONFIRMED" || status === "CHECKED_IN") && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setMode(mode === "extend" ? "none" : "extend")}>
            Extend Stay
          </Button>
        )}
        {(status === "CONFIRMED" || status === "CHECKED_IN") && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setMode(mode === "transfer" ? "none" : "transfer")}>
            Transfer Room
          </Button>
        )}
        {(status === "PENDING" || status === "CONFIRMED") && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setMode(mode === "cancel" ? "none" : "cancel")}>
            Cancel
          </Button>
        )}
        {(status === "PENDING" || status === "CONFIRMED") && (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => markNoShowAction(reservationId))}>
            Mark No-Show
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {mode === "cancel" && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="space-y-1.5">
            <Label>Cancellation reason</Label>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-72" />
          </div>
          <Button size="sm" variant="destructive" disabled={isPending || !cancelReason.trim()} onClick={() => run(() => cancelReservationAction(reservationId, cancelReason))}>
            Confirm Cancellation
          </Button>
        </div>
      )}

      {mode === "extend" && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="space-y-1.5">
            <Label>New check-out date</Label>
            <Input type="date" value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} />
          </div>
          <Button size="sm" disabled={isPending || !newCheckOut} onClick={() => run(() => extendStayAction(reservationId, newCheckOut))}>
            Extend
          </Button>
        </div>
      )}

      {mode === "transfer" && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="space-y-1.5">
            <Label>Transfer to room</Label>
            <Select value={transferRoomId} onChange={(e) => setTransferRoomId(e.target.value)} className="w-48">
              <option value="">Select a room</option>
              {availableRooms.filter((r) => r.id !== currentRoomId).map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className="w-56" />
          </div>
          <Button size="sm" disabled={isPending || !transferRoomId} onClick={() => run(() => transferRoomAction(reservationId, transferRoomId, transferReason))}>
            Transfer
          </Button>
        </div>
      )}

      {mode === "checkout" && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-sm text-foreground">Outstanding balance: <strong>{balance.toFixed(2)}</strong></p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Final payment amount</Label>
              <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="w-44">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allowOutstanding} onChange={(e) => setAllowOutstanding(e.target.checked)} />
            Allow checkout with an outstanding balance (collect later)
          </label>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => checkOutAction(reservationId, Number(payAmount) || 0, payMethod, allowOutstanding))}
          >
            Complete Check Out
          </Button>
        </div>
      )}
    </div>
  );
}

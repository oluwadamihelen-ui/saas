import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission, requireHotelUser, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getReservation } from "@/lib/services/reservations";
import { getGuestFolio } from "@/lib/services/folio";
import { listRooms } from "@/lib/services/rooms";
import { ReservationWorkflowPanel } from "../reservation-workflow-panel";
import { FolioPanel } from "../folio-panel";

export const metadata: Metadata = { title: "Reservation" };

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHotelUser();
  const perms = await getUserPermissions(user.id, user.hotelId);
  await requirePermission(PERMISSIONS.RESERVATIONS_VIEW);

  const { id } = await params;
  const [reservation, folio, allRooms] = await Promise.all([getReservation(user.hotelId, id), getGuestFolio(user.hotelId, id), listRooms(user.hotelId)]);
  if (!reservation || !folio) notFound();

  const currency = user.hotelCurrency ?? "USD";
  const canManageReservations = perms.has(PERMISSIONS.RESERVATIONS_MANAGE);
  const canCheckInOut = perms.has(PERMISSIONS.CHECKIN_MANAGE);
  const canPay = perms.has(PERMISSIONS.PAYMENTS_MANAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{reservation.reference}</h1>
          <p className="text-sm text-muted">
            {reservation.guest.firstName} {reservation.guest.lastName} · Room {reservation.room.roomNumber} ({reservation.roomType.name})
          </p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      {(canManageReservations || canCheckInOut) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationWorkflowPanel
              reservationId={reservation.id}
              status={reservation.status}
              balance={Number(reservation.balance)}
              currentRoomId={reservation.roomId}
              availableRooms={allRooms.filter((r) => r.status === "AVAILABLE").map((r) => ({ id: r.id, roomNumber: r.roomNumber }))}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stay Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Row label="Check-in" value={formatDate(reservation.checkInDate)} />
            <Row label="Check-out" value={formatDate(reservation.checkOutDate)} />
            <Row label="Nights" value={String(reservation.nights)} />
            <Row label="Adults / Children" value={`${reservation.adults} / ${reservation.children}`} />
            <Row label="Source" value={reservation.source.replaceAll("_", " ")} />
            <Row label="Created by" value={reservation.createdBy?.name ?? "—"} />
            {reservation.checkedInAt && <Row label="Checked in" value={`${formatDate(reservation.checkedInAt)} by ${reservation.checkedInBy?.name ?? "—"}`} />}
            {reservation.checkedOutAt && <Row label="Checked out" value={`${formatDate(reservation.checkedOutAt)} by ${reservation.checkedOutBy?.name ?? "—"}`} />}
            {reservation.cancellationReason && <Row label="Cancellation reason" value={reservation.cancellationReason} />}
            {reservation.notes && <Row label="Notes" value={reservation.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={`${reservation.guest.firstName} ${reservation.guest.lastName}`} />
            <Row label="Phone" value={reservation.guest.phone ?? "—"} />
            <Row label="Email" value={reservation.guest.email ?? "—"} />
            <Link href={`/app/guests/${reservation.guest.id}`} className="inline-block text-xs font-medium text-accent">
              View guest profile →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guest Folio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <table className="w-full text-sm">
            <tbody>
              <FolioRow label={folio.roomCharge.description} value={folio.roomCharge.total} currency={currency} />
              {folio.additionalCharges.map((c, idx) => (
                <FolioRow key={idx} label={c.description} value={c.total} currency={currency} />
              ))}
              <FolioRow label="Subtotal" value={folio.subtotal} currency={currency} muted />
              {folio.discount > 0 && <FolioRow label="Discount" value={-folio.discount} currency={currency} muted />}
              {folio.tax > 0 && <FolioRow label="Tax" value={folio.tax} currency={currency} muted />}
              <FolioRow label="Total" value={folio.total} currency={currency} bold />
              <FolioRow label="Amount Paid" value={folio.amountPaid} currency={currency} muted />
              <FolioRow label={folio.balance > 0 ? "Balance Due" : "Balance"} value={folio.balance} currency={currency} bold />
            </tbody>
          </table>

          {folio.payments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Payments</p>
              <ul className="space-y-1 text-sm">
                {folio.payments.map((p) => (
                  <li key={p.id} className="flex justify-between text-muted">
                    <span>
                      {p.reference} · {p.method.replaceAll("_", " ")} · {formatDate(p.paymentDate)}
                    </span>
                    <span className="text-foreground">{formatCurrency(p.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {["CONFIRMED", "CHECKED_IN"].includes(reservation.status) && (canManageReservations || canPay) && (
            <FolioPanel
              reservationId={reservation.id}
              guestId={reservation.guest.id}
              canManage={canManageReservations}
              canPay={canPay}
              canEditCharges={canManageReservations}
              charges={reservation.additionalCharges.map((c) => ({ id: c.id, description: c.description ?? c.type }))}
            />
          )}
        </CardContent>
      </Card>

      {reservation.roomTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Room Transfer History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {reservation.roomTransfers.map((t) => (
                <li key={t.id} className="text-muted">
                  Room {t.fromRoom.roomNumber} → Room {t.toRoom.roomNumber} · {formatDate(t.transferredAt)} {t.reason ? `· ${t.reason}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {reservation.invoice && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{reservation.invoice.invoiceNumber}</p>
              <p className="text-xs text-muted">Issued {formatDate(reservation.invoice.issuedAt)}</p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/invoices/${reservation.invoice.id}/pdf`} target="_blank" rel="noreferrer">
                View / Download PDF
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function FolioRow({ label, value, currency, bold, muted }: { label: string; value: number; currency: string; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={bold ? "border-t border-border font-semibold" : ""}>
      <td className={`py-1.5 ${muted ? "text-muted" : "text-foreground"}`}>{label}</td>
      <td className={`py-1.5 text-right ${muted ? "text-muted" : "text-foreground"}`}>{formatCurrency(value, currency)}</td>
    </tr>
  );
}

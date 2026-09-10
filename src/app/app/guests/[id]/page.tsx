import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getGuestProfile } from "@/lib/services/guests";

export const metadata: Metadata = { title: "Guest Profile" };

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.GUESTS_VIEW);
  const { id } = await params;
  const profile = await getGuestProfile(user.hotelId, id);
  if (!profile) notFound();

  const { guest, currentStay, upcoming, totalSpend } = profile;
  const currency = user.hotelCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {guest.firstName} {guest.lastName}
          </h1>
          <p className="text-sm text-muted">Guest since {formatDate(guest.createdAt)}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/app/guests/${guest.id}/edit`}>Edit Profile</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Phone" value={guest.phone} />
            <Row label="Email" value={guest.email} />
            <Row label="Address" value={guest.address} />
            <Row label="Nationality" value={guest.nationality} />
            <Row label="ID" value={guest.idType && guest.idNumber ? `${guest.idType}: ${guest.idNumber}` : guest.idNumber} />
            <Row label="Date of birth" value={guest.dateOfBirth ? formatDate(guest.dateOfBirth) : undefined} />
            <Row label="Emergency contact" value={guest.emergencyContactName ? `${guest.emergencyContactName} (${guest.emergencyContactPhone ?? "no phone"})` : undefined} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted">Preferences</p>
              <p className="text-foreground">{guest.preferences || "None recorded"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Notes</p>
              <p className="text-foreground">{guest.notes || "None recorded"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total spend" value={formatCurrency(totalSpend, currency)} />
            <Row label="Total stays" value={String(guest.reservations.filter((r) => r.status === "CHECKED_OUT").length)} />
            <Row label="Upcoming reservations" value={String(upcoming.length)} />
          </CardContent>
        </Card>
      </div>

      {currentStay && (
        <Card>
          <CardHeader>
            <CardTitle>Current Stay</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Room {currentStay.room.roomNumber} · {formatDate(currentStay.checkInDate)} – {formatDate(currentStay.checkOutDate)}
              </p>
              <p className="text-xs text-muted">Balance: {formatCurrency(currentStay.balance, currency)}</p>
            </div>
            <Button asChild size="sm">
              <Link href={`/app/reservations/${currentStay.id}`}>View Stay</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reservation History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {guest.reservations.length === 0 ? (
            <EmptyState title="No reservations yet" className="border-0 py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {guest.reservations.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                      Room {r.room.roomNumber} · {formatDate(r.checkInDate)} – {formatDate(r.checkOutDate)}
                    </Link>
                    <p className="text-xs text-muted">{r.reference}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right text-foreground">{value || "—"}</span>
    </div>
  );
}

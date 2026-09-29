import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getHotelById, listGroupBranches } from "@/lib/services/hotels";
import { getPaymentSettingsView } from "@/lib/services/payment-settings";
import { SettingsForm } from "./settings-form";
import { PaymentProcessorSettings } from "./payment-processor-form";

export const metadata: Metadata = { title: "Hotel Settings" };

export default async function SettingsPage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const hotel = await getHotelById(user.hotelId);
  if (!hotel) return null;
  const paymentSettings = await getPaymentSettingsView(user.hotelId);
  const branches = await listGroupBranches(user.hotelId);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Hotel Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Hotel information</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            hotel={{
              name: hotel.name,
              address: hotel.address ?? "",
              city: hotel.city ?? "",
              state: hotel.state ?? "",
              country: hotel.country ?? "",
              phone: hotel.phone ?? "",
              email: hotel.email ?? "",
              website: hotel.website ?? "",
              logoUrl: hotel.logoUrl ?? "",
              currency: hotel.currency,
              timezone: hotel.timezone,
              checkInTime: hotel.checkInTime,
              checkOutTime: hotel.checkOutTime,
              taxRatePercent: hotel.taxRatePercent.toString(),
              invoicePrefix: hotel.invoicePrefix,
              reservationPrefix: hotel.reservationPrefix,
              description: hotel.description ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Hotel branches</CardTitle>
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/settings/branches/new">Add a branch</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {branches.length <= 1 ? (
            <p className="text-sm text-muted">
              You&apos;re only managing one property right now. Add a branch to run more than one hotel from this
              same login -- each one&apos;s reservations, guests and payments stay fully separate.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {branches.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className={b.id === user.hotelId ? "font-medium text-foreground" : "text-muted"}>
                    {b.name}
                    {b.id === user.hotelId && " (current)"}
                  </span>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentProcessorSettings settings={paymentSettings} appUrl={appUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

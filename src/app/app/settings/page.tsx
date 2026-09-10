import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHotelById } from "@/lib/services/hotels";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Hotel Settings" };

export default async function SettingsPage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const hotel = await getHotelById(user.hotelId);
  if (!hotel) return null;

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
    </div>
  );
}

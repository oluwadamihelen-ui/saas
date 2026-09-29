import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { GuestForm } from "../../guest-form";
import { updateGuestAction } from "../../actions";

export const metadata: Metadata = { title: "Edit Guest" };

export default async function EditGuestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.GUESTS_MANAGE);
  const { id } = await params;
  const guest = await prisma.guest.findFirst({ where: { id, hotelId: user.hotelId } });
  if (!guest) notFound();

  const boundAction = updateGuestAction.bind(null, guest.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit {guest.firstName} {guest.lastName}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Guest details</CardTitle>
        </CardHeader>
        <CardContent>
          <GuestForm
            action={boundAction}
            submitLabel="Save Changes"
            defaultValues={{
              firstName: guest.firstName,
              lastName: guest.lastName,
              phone: guest.phone ?? "",
              email: guest.email ?? "",
              address: guest.address ?? "",
              nationality: guest.nationality ?? "",
              idType: guest.idType ?? "",
              idNumber: guest.idNumber ?? "",
              dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.toISOString().slice(0, 10) : "",
              emergencyContactName: guest.emergencyContactName ?? "",
              emergencyContactPhone: guest.emergencyContactPhone ?? "",
              preferences: guest.preferences ?? "",
              notes: guest.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

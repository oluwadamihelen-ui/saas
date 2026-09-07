import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Request Custom Work" };

export default async function NewCustomizationRequestPage() {
  const user = await requireUser();
  const licenses = await prisma.applicationLicense.findMany({
    where: { customerId: user.id, status: "ACTIVE" },
    include: { application: true },
    distinct: ["applicationId"],
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request Custom Work</h1>
        <p className="mt-1 text-sm text-muted">
          Tell us what you need and our team will follow up with an itemized quote — nothing is charged until you
          accept it.
        </p>
      </div>
      <Card>
        <CardContent>
          <RequestForm applications={licenses.map((l) => ({ id: l.application.id, name: l.application.name }))} />
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/checkout/${slug}`);
  }

  const application = await prisma.application.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { pricing: { where: { isActive: true } } },
  });
  if (!application) notFound();

  const hostingPlans = await prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

  return (
    <div className="container-shell py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-2 text-muted">Complete your purchase of {application.name}.</p>

      <div className="mt-10">
        <CheckoutForm
          applicationId={application.id}
          applicationName={application.name}
          pricing={application.pricing.map((p) => ({
            id: p.id,
            type: p.type,
            name: p.name,
            amount: Number(p.amount),
            currency: p.currency,
            billingCycle: p.billingCycle,
          }))}
          hostingPlans={hostingPlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly) }))}
          defaultEmail={session.user.email ?? ""}
          defaultName={session.user.name ?? ""}
        />
      </div>
    </div>
  );
}

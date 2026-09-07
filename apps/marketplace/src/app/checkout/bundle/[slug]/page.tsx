import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { BundleCheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function BundleCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/checkout/bundle/${slug}`);
  }

  const bundle = await prisma.bundle.findFirst({
    where: { slug, isActive: true },
    include: { items: { include: { application: true, hostingPlan: true } } },
  });
  if (!bundle) notFound();

  return (
    <div className="container-shell py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-2 text-muted">Complete your purchase of {bundle.name}.</p>

      <div className="mt-10">
        <BundleCheckoutForm
          bundleId={bundle.id}
          bundleName={bundle.name}
          price={Number(bundle.price)}
          currency={bundle.currency}
          items={bundle.items.map((item) => ({
            id: item.id,
            label:
              item.type === "APPLICATION"
                ? item.application?.name ?? "Application"
                : item.type === "HOSTING_PLAN"
                  ? `${item.hostingPlan?.name ?? "Hosting"} Hosting`
                  : (item.serviceLabel ?? "Item"),
            quantity: item.quantity,
          }))}
          defaultEmail={session.user.email ?? ""}
          defaultName={session.user.name ?? ""}
        />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getInvoiceByToken } from "@/lib/services/invoices";
import { BrandStyle } from "@/components/brand/brand-style";
import { SchoolLogo } from "@/components/brand/school-logo";

/// Shared by the invoice page and its confirm callback — the payer is
/// looking at their school's own payment page, not Winfield's, so this
/// shows the school's crest and brand color rather than the product's.
export default async function PayTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  return (
    <div className="space-y-4 sm:space-y-6">
      <BrandStyle color={invoice.school.brandColor} />
      <SchoolLogo name={invoice.school.name} logoUrl={invoice.school.logoUrl} height={28} />
      {children}
    </div>
  );
}

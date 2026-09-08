import { notFound } from "next/navigation";
import { getSchoolBySlug } from "@/lib/services/admission";
import { BrandStyle } from "@/components/brand/brand-style";
import { SchoolLogo } from "@/components/brand/school-logo";

/// Every /apply/[slug]/* page shares this — the school's own crest and
/// brand color, not Winfield's, since this is the applicant-facing part
/// of a school's own portal, not the product's marketing chrome.
export default async function ApplySchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  return (
    <div className="space-y-6">
      <BrandStyle color={school.brandColor} />
      <SchoolLogo name={school.name} logoUrl={school.logoUrl} height={28} />
      {children}
    </div>
  );
}

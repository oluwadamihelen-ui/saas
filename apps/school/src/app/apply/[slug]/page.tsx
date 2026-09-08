import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { getSchoolBySlug } from "@/lib/services/admission";
import { listClassGroups } from "@/lib/services/academics";
import { formatMoney } from "@/lib/money";
import { ApplyForm } from "./apply-form";

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const classGroups = await listClassGroups(school.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Logo height={28} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{school.name} — Admission Application</h1>
        <p className="text-sm text-muted">Tell us about your child to begin the admission process.</p>
      </div>

      {school.admissionFeeMinor ? (
        <Card>
          <CardHeader>
            <CardTitle>Admission fee</CardTitle>
            <CardDescription>{formatMoney(school.admissionFeeMinor, school.currency)} is payable after you submit this application.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <ApplyForm slug={slug} classGroups={classGroups} />
        </CardContent>
      </Card>
    </div>
  );
}

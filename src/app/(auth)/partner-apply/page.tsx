import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PartnerApplyForm } from "./partner-apply-form";

export const metadata: Metadata = { title: "Become a Schoolum Partner" };

export default function PartnerApplyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Join the Schoolum Partner Program</CardTitle>
        <CardDescription>Refer schools to Schoolum and earn a commission on what they pay us.</CardDescription>
      </CardHeader>
      <CardContent>
        <PartnerApplyForm />
        <p className="mt-6 text-center text-sm text-muted">
          Already a Partner?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          Want to know how commissions work first?{" "}
          <Link href="/partners" className="font-medium text-accent">
            Learn more about the Partner Program
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

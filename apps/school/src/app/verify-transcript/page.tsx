import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyTranscriptPublic } from "@/lib/services/transcripts";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Verify a Transcript — Winfield" };

export default async function VerifyTranscriptPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const trimmedRef = ref?.trim();
  const result = trimmedRef ? await verifyTranscriptPublic(trimmedRef) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Verify an academic transcript</h1>
        <p className="text-sm text-muted">
          Enter the reference number printed on a Winfield academic transcript to confirm it&apos;s genuine.
        </p>
      </div>

      <Card>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="ref">
                Transcript reference number
              </label>
              <Input id="ref" name="ref" defaultValue={trimmedRef ?? ""} placeholder="WIN-TR-2026-000123" />
            </div>
            <Button type="submit">Verify</Button>
          </form>
        </CardContent>
      </Card>

      {trimmedRef && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{result ? result.schoolName : "Verification result"}</CardTitle>
              {result && (
                <Badge variant={result.status === "ACTIVE" ? "success" : "danger"}>
                  {result.status === "ACTIVE" ? "Valid" : "Revoked"}
                </Badge>
              )}
            </div>
            {!result && <CardDescription>No transcript was found for this reference number. It may be invalid or mistyped.</CardDescription>}
          </CardHeader>
          {result && (
            <CardContent className="space-y-2 text-sm">
              <Row label="Reference number" value={result.referenceNumber} />
              <Row label="Student" value={result.studentName} />
              <Row label="School" value={result.schoolName} />
              <Row label="Date issued" value={formatDate(result.generatedAt)} />
              {result.status === "REVOKED" && (
                <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
                  This transcript has been revoked by the issuing school and is no longer valid.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

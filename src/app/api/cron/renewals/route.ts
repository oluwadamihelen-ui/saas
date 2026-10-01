import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { renewDueSubscriptions } from "@/lib/renewals";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return new NextResponse(auth.status === 503 ? "CRON_SECRET not configured" : "Unauthorized", { status: auth.status });
  const report = await renewDueSubscriptions(new Date(), (userId) =>
    notifyUser(userId, "billing", `renewal-failed:${new Date().toISOString().slice(0, 10)}`, "Your RiskPilot Pro renewal payment didn't go through. Please update your payment method in Plan & billing to keep Pro.").then(() => {}),
  );
  return NextResponse.json(report);
}

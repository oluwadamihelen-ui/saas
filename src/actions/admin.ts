"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { z } from "zod";
import { saveMarketSettings } from "@/lib/market/settings";
import { processPayout, resolveReport, reviewListing, saveCategory, setCreatorStatus, setCreatorVerified, verifyPayoutMethod } from "@/lib/market/admin";
import { refundOrder } from "@/lib/market/orders";
import { setReviewStatus } from "@/lib/market/reviews";
import type { ActionState } from "@/lib/validation";

async function actor() {
  const u = await requireAdmin(); // 404 for non-admins
  return { id: u.id, role: u.role } as const;
}
const back = (path: string, kind: "error" | "ok", msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

export async function reviewListingAction(fd: FormData) {
  const a = await actor();
  const id = String(fd.get("id"));
  const decision = z.enum(["APPROVE", "REJECT", "SUSPEND", "UNSUSPEND"]).parse(fd.get("decision"));
  const r = await reviewListing(a, id, decision, String(fd.get("reason") ?? ""));
  revalidatePath("/admin", "layout");
  const done = { APPROVE: "approved", REJECT: "rejected", SUSPEND: "suspended", UNSUSPEND: "reinstated" }[decision];
  back(`/admin/listings/${id}`, r.ok ? "ok" : "error", r.ok ? `Listing ${done}.` : r.error);
}

export async function creatorAdminAction(fd: FormData) {
  const a = await actor();
  const id = String(fd.get("id"));
  const op = z.enum(["verify", "unverify", "suspend", "activate", "verify_payout"]).parse(fd.get("op"));
  if (op === "verify" || op === "unverify") await setCreatorVerified(a, id, op === "verify");
  else if (op === "suspend" || op === "activate") await setCreatorStatus(a, id, op === "suspend" ? "SUSPENDED" : "ACTIVE");
  else await verifyPayoutMethod(a, id);
  revalidatePath("/admin/creators");
}

export async function refundOrderAction(fd: FormData) {
  const a = await actor();
  const r = await refundOrder(a, String(fd.get("id")), String(fd.get("reason") ?? "Refund issued by admin"));
  revalidatePath("/admin/orders");
  back("/admin/orders", r.ok ? "ok" : "error", r.ok ? "Refund issued." : r.error);
}

export async function payoutAction(fd: FormData) {
  const a = await actor();
  const outcome = z.enum(["PAID", "FAILED", "CANCELED"]).parse(fd.get("outcome"));
  const r = await processPayout(a, String(fd.get("id")), outcome, String(fd.get("reference") ?? ""));
  revalidatePath("/admin/payouts");
  back("/admin/payouts", r.ok ? "ok" : "error", r.ok ? `Payout marked ${outcome.toLowerCase()}.` : r.error);
}

export async function reportAction(fd: FormData) {
  const a = await actor();
  const action = z.enum(["DISMISS", "HIDE_REVIEW", "SUSPEND_LISTING"]).parse(fd.get("action"));
  const r = await resolveReport(a, String(fd.get("id")), action, String(fd.get("note") ?? ""));
  revalidatePath("/admin/reports");
  back("/admin/reports", r.ok ? "ok" : "error", r.ok ? "Report handled." : r.error);
}

export async function reviewVisibilityAction(fd: FormData) {
  const a = await actor();
  await setReviewStatus(a, String(fd.get("id")), fd.get("status") === "HIDDEN" ? "HIDDEN" : "VISIBLE");
  revalidatePath("/admin/reports");
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const n = (k: string) => Number(fd.get(k));
  const cents = (k: string) => Math.round(Number(fd.get(k)) * 100);
  const r = await saveMarketSettings(a, {
    commissionPercent: n("commissionPercent"), processingFeePercent: n("processingFeePercent"), processingFeeFixedCents: cents("processingFeeFixed"), taxPercent: n("taxPercent"),
    feeBearer: fd.get("feeBearer") === "platform" ? "platform" : "creator", holdbackDays: n("holdbackDays"), minPayoutUsdCents: cents("minPayout"), ngnPerUsd: n("ngnPerUsd"), minEvidenceTrades: n("minEvidenceTrades"),
    priceLimits: { ONE_TIME: { minCents: cents("ot_min"), maxCents: cents("ot_max") }, MONTHLY: { minCents: cents("m_min"), maxCents: cents("m_max") }, YEARLY: { minCents: cents("y_min"), maxCents: cents("y_max") } },
  });
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved. New orders use them immediately; existing orders keep the terms they were placed with." };
}

export async function saveCategoryAction(fd: FormData) {
  const a = await actor();
  const r = await saveCategory(a, { id: String(fd.get("id") ?? "") || undefined, name: String(fd.get("name") ?? ""), sort: Number(fd.get("sort") ?? 99), active: fd.get("active") !== "off" });
  revalidatePath("/admin/settings");
  if (!r.ok) back("/admin/settings", "error", r.error);
}


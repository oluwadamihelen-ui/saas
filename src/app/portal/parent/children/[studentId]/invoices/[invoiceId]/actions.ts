"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSchoolUser } from "@/lib/auth/require";
import { getChildForGuardian } from "@/lib/services/portal";
import { getInvoice } from "@/lib/services/invoices";
import { initiateOnlinePayment, notifyBankTransfer } from "@/lib/services/payments";

export interface PortalPayFormState {
  status: "idle" | "error";
  message?: string;
}

async function currentOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/// Both actions below re-verify the invoice belongs to one of the signed-in
/// parent's own children on every call — the studentId/invoiceId in the URL
/// are never trusted on their own, the same as every other portal page.
async function requireOwnInvoice(studentId: string, invoiceId: string) {
  const user = await requireSchoolUser();
  const student = await getChildForGuardian(user.schoolId, user.id, studentId);
  if (!student) throw new Error("Not found");

  const invoice = await getInvoice(user.schoolId, invoiceId);
  if (!invoice || invoice.studentId !== studentId) throw new Error("Not found");

  return invoice;
}

export async function payOnlineFromPortalAction(
  studentId: string,
  invoiceId: string,
  _prev: PortalPayFormState,
  _formData: FormData
): Promise<PortalPayFormState> {
  const invoice = await requireOwnInvoice(studentId, invoiceId);

  let authorizationUrl: string;
  try {
    const origin = await currentOrigin();
    const callbackUrl = `${origin}/portal/parent/children/${studentId}/invoices/${invoiceId}/confirm`;
    const result = await initiateOnlinePayment(invoice.payToken, callbackUrl);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start payment." };
  }
  redirect(authorizationUrl);
}

export async function notifyBankTransferFromPortalAction(
  studentId: string,
  invoiceId: string,
  _prev: PortalPayFormState,
  _formData: FormData
): Promise<PortalPayFormState> {
  const invoice = await requireOwnInvoice(studentId, invoiceId);

  try {
    await notifyBankTransfer(invoice.payToken);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not record your notice." };
  }
  redirect(`/portal/parent/children/${studentId}/invoices/${invoiceId}`);
}

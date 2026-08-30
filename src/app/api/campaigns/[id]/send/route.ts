import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { sendText } from "@/lib/whatsapp/client";

/**
 * Sends a campaign's message to each recipient over WhatsApp. Meta only
 * allows free-form messages within a 24-hour customer service window, or
 * via a pre-approved message template outside it — this MVP sends as a
 * free-form text message, so in production this should be swapped for an
 * approved WhatsAppTemplate for anyone outside that window. Recipients are
 * marked SENT/FAILED individually so a partial failure is fully visible.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const businessId = body.businessId as string;
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { recipients: { include: { customer: true } } },
    });
    if (!campaign || campaign.businessId !== businessId) throw new TenantError("Campaign not found", 404);

    const account = await prisma.whatsAppAccount.findUnique({ where: { businessId } });
    if (!account?.isConnected) {
      return NextResponse.json({ error: "Connect WhatsApp before sending campaigns" }, { status: 422 });
    }

    await prisma.campaign.update({ where: { id }, data: { status: "SENDING" } });

    let sent = 0;
    let failed = 0;
    for (const recipient of campaign.recipients) {
      try {
        await sendText(account, recipient.customer.phone, campaign.message);
        await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "SENT" } });
        sent += 1;
      } catch {
        await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "FAILED" } });
        failed += 1;
      }
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      include: { recipients: true },
    });

    return NextResponse.json({ campaign: updated, sent, failed });
  } catch (err) {
    return apiError(err);
  }
}

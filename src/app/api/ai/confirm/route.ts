import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { confirmToolCall } from "@/lib/ai/chat-service";

const schema = z.object({
  businessId: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  approve: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await requireBusinessMembership(data.businessId);

    const result = await confirmToolCall(data.businessId, data.conversationId, data.messageId, data.approve);
    return NextResponse.json({ conversationId: data.conversationId, ...result });
  } catch (err) {
    return apiError(err);
  }
}

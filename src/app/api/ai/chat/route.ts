import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { assertAiMessageLimit } from "@/lib/subscription";
import { runChatTurn } from "@/lib/ai/chat-service";

const schema = z.object({
  businessId: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    await assertAiMessageLimit(data.businessId);

    const { conversationId, result } = await runChatTurn(
      data.businessId,
      membership.userId,
      data.conversationId,
      data.message
    );

    return NextResponse.json({ conversationId, ...result });
  } catch (err) {
    return apiError(err);
  }
}

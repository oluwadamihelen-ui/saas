import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = transactions.length > PAGE_SIZE;
    const page = hasMore ? transactions.slice(0, PAGE_SIZE) : transactions;

    return NextResponse.json({
      transactions: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

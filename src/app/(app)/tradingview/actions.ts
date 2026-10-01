"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/session";
import { revalidatePath } from "next/cache";

const schema = z.object({
  accountSize: z.number().positive(), riskPercent: z.number().gt(0).max(100), entry: z.number(), stopLoss: z.number(), takeProfit: z.number(),
  valuePerPointPerLot: z.number().positive(), minLot: z.number().positive(), lotStep: z.number().positive(),
});

export async function savePineToolAction(name: string, params: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user, plan } = await getContext();
  if (!plan.limits.tradingViewTools) return { ok: false, error: "Pro feature." };
  const p = schema.safeParse(params);
  if (!p.success) return { ok: false, error: "Check your numbers." };
  await prisma.pineTool.create({ data: { userId: user.id, name: name.slice(0, 60), params: p.data } });
  revalidatePath("/tradingview");
  return { ok: true };
}

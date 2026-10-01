"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import type { InstrumentSpec } from "@/lib/engine/risk";

const savePayload = z.object({
  instrument: z.string().regex(/^[A-Z0-9._-]{2,20}$/),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive().nullable(),
  balance: z.number().positive(),
  riskPercent: z.number().gt(0).max(100),
  riskAmount: z.number().nonnegative(),
  lots: z.number().positive(),
  lossPerLot: z.number().positive(),
  specConfirmed: z.boolean(),
  inputs: z.record(z.string(), z.unknown()),
});

export async function saveCalculationAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user, account } = await getContext();
  if (!rateLimit(`calc:${user.id}`, 60, 60_000).ok) return { ok: false, error: "Slow down a little." };
  const p = savePayload.safeParse(raw);
  if (!p.success) return { ok: false, error: "Invalid calculation." };
  await prisma.positionCalculation.create({ data: { ...p.data, inputs: JSON.parse(JSON.stringify(p.data.inputs)), userId: user.id, accountId: account.id } });
  revalidatePath("/calculator");
  return { ok: true };
}

const specSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9._-]{2,20}$/),
  contractSize: z.number().positive(),
  tickSize: z.number().positive(),
  tickValue: z.number().positive(),
  minLot: z.number().positive(),
  maxLot: z.number().positive(),
  lotStep: z.number().positive(),
  quoteCurrency: z.string().regex(/^[A-Z]{3}$/),
}).refine((s) => s.maxLot >= s.minLot);

export async function saveSpecAction(symbol: string, spec: InstrumentSpec, confirmed: boolean): Promise<{ ok: boolean; error?: string }> {
  const { user, account } = await getContext();
  const parsed = specSchema.safeParse({ ...spec, symbol });
  if (!parsed.success) return { ok: false, error: "Those contract values are not valid." };
  const specs = { ...((account.specs as object) ?? {}), [symbol]: { spec: parsed.data, confirmed: !!confirmed } };
  await prisma.account.updateMany({ where: { id: account.id, userId: user.id }, data: { specs } });
  revalidatePath("/calculator");
  return { ok: true };
}

export async function deleteCalculationAction(id: string) {
  const { user } = await getContext();
  await prisma.positionCalculation.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/calculator");
}

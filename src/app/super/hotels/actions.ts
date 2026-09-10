"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require";
import { setHotelStatus, setHotelPlan } from "@/lib/services/hotels";
import type { HotelStatus, SubscriptionPlan } from "@/generated/prisma/enums";

export async function setHotelStatusAction(hotelId: string, status: HotelStatus) {
  const actor = await requireSuperAdmin();
  await setHotelStatus(hotelId, actor.id, status);
  revalidatePath("/super/hotels");
  revalidatePath(`/super/hotels/${hotelId}`);
}

export async function setHotelPlanAction(hotelId: string, plan: SubscriptionPlan) {
  const actor = await requireSuperAdmin();
  await setHotelPlan(hotelId, actor.id, plan);
  revalidatePath("/super/hotels");
  revalidatePath(`/super/hotels/${hotelId}`);
}

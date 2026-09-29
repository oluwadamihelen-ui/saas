"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { setHotelStatusAction, setHotelPlanAction } from "./actions";
import type { HotelStatus, SubscriptionPlan } from "@/generated/prisma/enums";

const STATUSES: HotelStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"];
const PLANS: SubscriptionPlan[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];

export function HotelControls({ hotelId, status, plan }: { hotelId: string; status: HotelStatus; plan: SubscriptionPlan }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted">Status</label>
        <Select
          defaultValue={status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(async () => {
              await setHotelStatusAction(hotelId, e.target.value as HotelStatus);
              router.refresh();
            })
          }
          className="w-40"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted">Plan</label>
        <Select
          defaultValue={plan}
          disabled={isPending}
          onChange={(e) =>
            startTransition(async () => {
              await setHotelPlanAction(hotelId, e.target.value as SubscriptionPlan);
              router.refresh();
            })
          }
          className="w-44"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

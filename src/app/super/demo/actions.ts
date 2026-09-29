"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require";
import { seedDemoAccount } from "@/lib/services/demo";
import { logger } from "@/lib/security/logger";

export interface DemoAccountActionState {
  status: "idle" | "success" | "error";
  message?: string;
  ownerEmail?: string;
  password?: string;
  branchNames?: string[];
  alreadyExisted?: boolean;
}

export async function createDemoAccountAction(): Promise<DemoAccountActionState> {
  const actor = await requireSuperAdmin();

  try {
    const result = await seedDemoAccount(actor.id);
    revalidatePath("/super/demo");
    return {
      status: "success",
      ownerEmail: result.ownerEmail,
      password: result.password,
      branchNames: result.branches.map((b) => b.name),
      alreadyExisted: !result.created,
    };
  } catch (error) {
    logger.error("demo.account_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create the demo account right now." };
  }
}

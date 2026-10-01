import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Wizard } from "./wizard";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Set up your risk rules" };

export default async function OnboardingPage() {
  const user = await getUser();
  // Only skip onboarding when there is actually an account to show (avoids a /dashboard ↔ /onboarding loop).
  if (user.onboardedAt && (await prisma.account.count({ where: { userId: user.id, archivedAt: null } })) > 0) redirect("/dashboard");
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-8">
      <Logo className="mb-8 text-lg" />
      <Wizard />
    </main>
  );
}

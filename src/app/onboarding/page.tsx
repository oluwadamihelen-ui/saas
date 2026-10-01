import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { Wizard } from "./wizard";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Set up your risk rules" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (user.onboardedAt) redirect("/dashboard");
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-8">
      <Logo className="mb-8 text-lg" />
      <Wizard />
    </main>
  );
}

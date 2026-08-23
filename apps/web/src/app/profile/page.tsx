import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { EditNameForm } from "@/components/account/EditNameForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ManageBillingButton } from "@/components/ManageBillingButton";

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  UNPAID: "Unpaid",
  INCOMPLETE: "Incomplete",
};

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscription: { include: { plan: true } } },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Manage your account and subscription.</p>

          <section className="card mt-6">
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="mt-1 text-sm text-cinerra-muted">{user.email}</p>
            <div className="mt-4">
              <EditNameForm initialName={user.name ?? ""} />
            </div>
            {user.termsAcceptedAt && (
              <p className="mt-4 text-[11px] text-cinerra-muted">
                Accepted the Terms of Service and Privacy Policy on {user.termsAcceptedAt.toLocaleDateString()}.
              </p>
            )}
          </section>

          {user.passwordHash && (
            <section className="card mt-6">
              <h2 className="text-lg font-semibold">Password</h2>
              <div className="mt-4">
                <ChangePasswordForm />
              </div>
            </section>
          )}

          <section className="card mt-6">
            <h2 className="text-lg font-semibold">Billing</h2>
            {user.subscription ? (
              <>
                <p className="mt-1 text-sm text-cinerra-text">
                  {user.subscription.plan.name} · <span className="text-cinerra-muted">{STATUS_LABEL[user.subscription.status] ?? user.subscription.status}</span>
                </p>
                {user.subscription.currentPeriodEnd && (
                  <p className="mt-1 text-xs text-cinerra-muted">
                    {user.subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {user.subscription.currentPeriodEnd.toLocaleDateString()}
                  </p>
                )}
                <div className="mt-4">
                  <ManageBillingButton />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-cinerra-muted">No subscription yet.</p>
            )}
          </section>

          <section className="card mt-6 border-red-500/20">
            <h2 className="text-lg font-semibold text-red-300">Delete account</h2>
            <p className="mt-1 text-sm text-cinerra-muted">
              This permanently deletes your account, movies, and generated media. To request deletion, email{" "}
              <a href="mailto:privacy@cinerra.app" className="text-cinerra-accent underline">
                privacy@cinerra.app
              </a>{" "}
              from your account&rsquo;s email address.
            </p>
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

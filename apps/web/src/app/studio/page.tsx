import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { prisma } from "@/lib/db";
import { getOrganizationForUser } from "@/lib/organizations";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { EmptyState } from "@/components/EmptyState";
import { CreateOrganizationForm } from "@/components/studio/CreateOrganizationForm";
import { InviteMemberForm } from "@/components/studio/InviteMemberForm";
import { MemberList } from "@/components/studio/MemberList";

export default async function StudioPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  requireAcceptedTerms(session, "/studio");

  const [organization, subscription] = await Promise.all([
    getOrganizationForUser(userId),
    prisma.subscription.findUnique({ where: { userId }, include: { plan: true } }),
  ]);

  const seats = subscription?.plan.seats ?? 1;
  const eligible = seats > 1;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Studio</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Team collaboration for Studio plan subscribers.</p>

          {!organization && !eligible && (
            <div className="mt-6">
              <EmptyState
                title="Studio plan required"
                description="Creating a team and inviting collaborators is part of the Studio plan. Upgrade to get started."
                ctaLabel="View plans"
                ctaHref="/pricing"
              />
            </div>
          )}

          {!organization && eligible && (
            <section className="card mt-6">
              <h2 className="text-lg font-semibold">Create your studio</h2>
              <p className="mt-1 text-sm text-cinerra-muted">Give your team a name. You&rsquo;ll be able to invite up to {seats} people, including you.</p>
              <div className="mt-4">
                <CreateOrganizationForm />
              </div>
            </section>
          )}

          {organization && (
            <>
              <section className="card mt-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">{organization.name}</h2>
                  <span className="text-xs text-cinerra-muted">
                    {organization.members.length} of {organization.seats} seats used
                  </span>
                </div>
                <div className="mt-4">
                  <MemberList
                    currentUserId={userId}
                    ownerId={organization.ownerId}
                    members={organization.members}
                    pendingInvites={organization.invites.map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt.toISOString() }))}
                  />
                </div>
              </section>

              {organization.ownerId === userId && (
                <section className="card mt-6">
                  <h2 className="text-lg font-semibold">Invite a teammate</h2>
                  <p className="mt-1 text-sm text-cinerra-muted">
                    {organization.members.length >= organization.seats
                      ? "You've used all the seats on your plan."
                      : "They'll get an email with a link to join."}
                  </p>
                  <div className="mt-4">
                    <InviteMemberForm disabled={organization.members.length >= organization.seats} />
                  </div>
                </section>
              )}
            </>
          )}

          <p className="mt-8 text-xs text-cinerra-muted">
            Studio teams share membership today — everyone on the roster can see who else is on it. Shared project access (browsing or co-editing a
            teammate&rsquo;s movie) and commercial-production tooling beyond that are still on the roadmap.
          </p>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { acceptOrganizationInvite, InvalidInviteError, InviteEmailMismatchError, AlreadyInOrganizationError, SeatLimitReachedError } from "@/lib/organizations";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { Logo } from "@/components/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: new InvalidInviteError().message,
  mismatch: new InviteEmailMismatchError().message,
  "already-in-org": new AlreadyInOrganizationError().message,
  full: new SeatLimitReachedError().message,
};

export default async function StudioInvitePage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  const token = searchParams.token ?? "";
  const session = await auth();

  async function acceptAction() {
    "use server";
    const currentSession = await auth();
    const userId = (currentSession?.user as { id?: string } | undefined)?.id;
    if (!userId) redirect(`/login`);
    requireAcceptedTerms(currentSession, `/studio/invite?token=${token}`);

    try {
      await acceptOrganizationInvite(userId, token);
    } catch (error) {
      if (error instanceof InvalidInviteError) redirect(`/studio/invite?token=${token}&error=invalid`);
      if (error instanceof InviteEmailMismatchError) redirect(`/studio/invite?token=${token}&error=mismatch`);
      if (error instanceof AlreadyInOrganizationError) redirect(`/studio/invite?token=${token}&error=already-in-org`);
      if (error instanceof SeatLimitReachedError) redirect(`/studio/invite?token=${token}&error=full`);
      throw error;
    }

    redirect("/studio");
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm text-center">
          <Logo className="mb-6 block justify-center" />
          <h1 className="mb-1 text-xl font-semibold">Join a studio team</h1>

          {!token ? (
            <p className="mt-4 text-sm text-cinerra-muted">This invite link is missing its token.</p>
          ) : searchParams.error ? (
            <>
              <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{ERROR_MESSAGES[searchParams.error] ?? "Something went wrong."}</p>
              {!session && (
                <p className="mt-4 text-sm text-cinerra-muted">
                  <Link href="/login" className="text-cinerra-text underline">
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link href="/signup" className="text-cinerra-text underline">
                    create an account
                  </Link>{" "}
                  with the email this invite was sent to, then come back to this link.
                </p>
              )}
            </>
          ) : !session ? (
            <p className="mt-4 text-sm text-cinerra-muted">
              <Link href="/login" className="text-cinerra-text underline">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/signup" className="text-cinerra-text underline">
                create an account
              </Link>{" "}
              with the email this invite was sent to, then come back to this link to accept.
            </p>
          ) : (
            <form action={acceptAction} className="mt-4">
              <p className="mb-4 text-sm text-cinerra-muted">Accept this invite to join the team.</p>
              <button type="submit" className="btn-primary w-full py-3">
                Accept invite
              </button>
            </form>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

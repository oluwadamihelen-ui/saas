import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { StoryWizardForm } from "@/components/create/StoryWizardForm";

export default async function NewProjectPage({ searchParams }: { searchParams: { mode?: string } }) {
  const session = await auth();
  if (!(session?.user as { id?: string } | undefined)?.id) redirect("/login");
  requireAcceptedTerms(session, "/projects/new");

  const mode = searchParams.mode === "ADAPTATION" ? "ADAPTATION" : "INSPIRATION";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cinerra-muted">
            <StepBadge n={1} active label="Story" />
            <StepDivider />
            <StepBadge n={2} label="Script" />
            <StepDivider />
            <StepBadge n={3} label="Assets" />
            <StepDivider />
            <StepBadge n={4} label="Storyboard" />
            <StepDivider />
            <StepBadge n={5} label="Preview" />
          </div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Create your movie</h1>
        </div>
        <StoryWizardForm initialMode={mode} />
      </main>
      <MobileNav />
    </div>
  );
}

function StepBadge({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${active ? "text-cinerra-text" : ""}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
          active ? "bg-cinerra-accent text-white" : "border border-cinerra-border"
        }`}
      >
        {n}
      </span>
      {label}
    </span>
  );
}

function StepDivider() {
  return <span className="h-px w-6 bg-cinerra-border" />;
}

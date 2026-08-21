import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/ai";
import { Header } from "@/components/Header";

const CAPABILITIES = ["TEXT", "IMAGE", "VIDEO", "VOICE", "MUSIC", "SOUND_EFFECT"] as const;

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const [userCount, activeSubscriptions, jobStats, plans, recentJobs] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    prisma.generationJob.groupBy({ by: ["status"], _count: true }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.generationJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { email: true } } } }),
  ]);

  const mrrCents = activeSubscriptions.reduce((sum, s) => sum + (s.interval === "MONTH" ? s.plan.priceMonthlyCents : s.plan.priceYearlyCents / 12), 0);
  const planDistribution = new Map<string, number>();
  for (const s of activeSubscriptions) planDistribution.set(s.plan.name, (planDistribution.get(s.plan.name) ?? 0) + 1);

  const succeeded = jobStats.find((s) => s.status === "SUCCEEDED")?._count ?? 0;
  const failed = jobStats.find((s) => s.status === "FAILED")?._count ?? 0;
  const totalJobs = jobStats.reduce((sum, s) => sum + s._count, 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-2xl font-bold">Admin</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={userCount} />
          <Stat label="Active subscriptions" value={activeSubscriptions.length} />
          <Stat label="MRR" value={`$${(mrrCents / 100).toFixed(0)}`} />
          <Stat label="Generation jobs" value={totalJobs} />
        </div>

        <section className="card mt-8">
          <h2 className="text-lg font-semibold">AI Providers</h2>
          <p className="mt-1 text-sm text-cinerra-muted">Configured via environment variables — never exposed to customers.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CAPABILITIES.map((cap) => {
              const configured = providerRegistry.isConfigured(cap);
              return (
                <div key={cap} className="flex items-center justify-between rounded-lg border border-cinerra-border px-3 py-2 text-sm">
                  <span>{cap.replace(/_/g, " ")}</span>
                  <span className={configured ? "text-emerald-400" : "text-cinerra-muted"}>{configured ? "Configured" : "Not configured"}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Generation success rate</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            {succeeded} succeeded / {failed} failed / {totalJobs} total
          </p>
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Plans</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-cinerra-muted">
              <tr>
                <th className="pb-2">Plan</th>
                <th className="pb-2">Monthly</th>
                <th className="pb-2">Yearly</th>
                <th className="pb-2">Max concurrent</th>
                <th className="pb-2">Subscribers</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t border-cinerra-border">
                  <td className="py-2">{plan.name}</td>
                  <td className="py-2">${(plan.priceMonthlyCents / 100).toFixed(0)}</td>
                  <td className="py-2">${(plan.priceYearlyCents / 100).toFixed(0)}</td>
                  <td className="py-2">{plan.maxConcurrentGenerations}</td>
                  <td className="py-2">{planDistribution.get(plan.name) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Recent generation jobs</h2>
          <div className="mt-3 flex flex-col divide-y divide-cinerra-border">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{job.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-cinerra-muted">{job.user.email}</p>
                </div>
                <span className="text-xs text-cinerra-muted">{job.status}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-cinerra-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

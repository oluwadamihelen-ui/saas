import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/ai";
import { Header } from "@/components/Header";
import { ModerationQueue } from "@/components/ModerationQueue";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { GrantPromotionalCoinsForm } from "@/components/admin/GrantPromotionalCoinsForm";
import { DailyRevenueChart } from "@/components/admin/DailyRevenueChart";
import { RiskUserActions } from "@/components/admin/RiskUserActions";
import { SuspendUserForm } from "@/components/admin/SuspendUserForm";
import { getRevenueAnalytics } from "@/lib/analytics";
import { getEngagementAnalytics } from "@/lib/viewingEvents";
import { getFraudSignals } from "@/lib/trustSafety";

const CAPABILITIES = ["TEXT", "IMAGE", "VIDEO", "VOICE", "MUSIC", "SOUND_EFFECT"] as const;

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const [userCount, activeSubscriptions, jobStats, plans, recentJobs, pendingPublications, platformSettings, revenueAnalytics, engagementAnalytics, fraudSignals] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    prisma.generationJob.groupBy({ by: ["status"], _count: true }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.generationJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { email: true } } } }),
    prisma.publication.findMany({
      where: { moderationStatus: "PENDING" },
      orderBy: { publishedAt: "asc" },
      include: { project: { select: { title: true } }, publishedBy: { select: { name: true, email: true } } },
    }),
    prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    getRevenueAnalytics(),
    getEngagementAnalytics(),
    getFraudSignals(),
  ]);

  const moderationQueueItems = pendingPublications.map((p) => ({
    id: p.id,
    projectTitle: p.project.title,
    creatorName: p.publishedBy.name ?? p.publishedBy.email,
    publishedAt: p.publishedAt.toISOString(),
  }));

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Discover moderation queue</h2>
            {moderationQueueItems.length > 0 && (
              <span className="rounded-full bg-cinerra-gold/20 px-2.5 py-0.5 text-xs font-semibold text-cinerra-gold">
                {moderationQueueItems.length} pending
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-cinerra-muted">
            A publication only appears on Discover once approved here — publishing alone doesn&rsquo;t make it public.
          </p>
          <div className="mt-4">
            <ModerationQueue items={moderationQueueItems} />
          </div>
        </section>

        <section className="card mt-6">
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
          <h2 className="text-lg font-semibold">Revenue analytics</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            Computed from settled unlock transactions only. Conversion rate (viewers who watched vs. who paid) isn&rsquo;t shown here — nothing
            in the app writes view/impression events yet, so that number would be fabricated rather than real.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total coin revenue" value={`🪙 ${revenueAnalytics.totals.coinRevenue.toLocaleString()}`} />
            <Stat label="Publisher share" value={`🪙 ${revenueAnalytics.totals.publisherShare.toLocaleString()}`} />
            <Stat label="Platform share" value={`🪙 ${revenueAnalytics.totals.platformShare.toLocaleString()}`} />
            <Stat label="Avg revenue / viewer" value={`🪙 ${revenueAnalytics.totals.avgRevenuePerViewer.toFixed(1)}`} />
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Daily coin revenue (last 30 days)</p>
            <DailyRevenueChart data={revenueAnalytics.dailyRevenue} />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Top movies/episodes by revenue</p>
              <div className="flex flex-col divide-y divide-cinerra-border">
                {revenueAnalytics.topProjects.length === 0 ? (
                  <p className="py-2 text-sm text-cinerra-muted">No unlocks yet.</p>
                ) : (
                  revenueAnalytics.topProjects.map((p) => (
                    <div key={p.projectTitle} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="text-cinerra-text">{p.projectTitle}</p>
                        <p className="text-xs text-cinerra-muted">{p.unlockCount.toLocaleString()} unlocks</p>
                      </div>
                      <span className="font-medium">🪙 {p.coins.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Top creators by earnings</p>
              <div className="flex flex-col divide-y divide-cinerra-border">
                {revenueAnalytics.topPublishers.length === 0 ? (
                  <p className="py-2 text-sm text-cinerra-muted">No earnings yet.</p>
                ) : (
                  revenueAnalytics.topPublishers.map((p) => (
                    <div key={p.publisherId ?? p.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-cinerra-text">{p.name}</span>
                      <span className="font-medium">🪙 {p.coins.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Content engagement</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            Last 30 days. This is engagement (starts, completion), not purchase conversion — the watch page only ever plays content a viewer
            already has access to, so there&rsquo;s no &ldquo;saw the paywall&rdquo; event to measure a real conversion funnel from.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Playback starts" value={engagementAnalytics.totalStarts.toLocaleString()} />
            <Stat label="Completion rate" value={`${(engagementAnalytics.completionRate * 100).toFixed(0)}%`} />
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Most-watched content</p>
            <div className="flex flex-col divide-y divide-cinerra-border">
              {engagementAnalytics.topContent.length === 0 ? (
                <p className="py-2 text-sm text-cinerra-muted">No playback yet.</p>
              ) : (
                engagementAnalytics.topContent.map((c) => (
                  <div key={c.projectId} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-cinerra-text">{c.projectTitle}</span>
                    <span className="font-medium">{c.starts.toLocaleString()} starts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Coin economy settings</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            Revenue share, price ranges, and payout economics — previously only editable via direct database access.
          </p>
          <PlatformSettingsForm
            initial={{
              publisherRevenueShareBps: platformSettings.publisherRevenueShareBps,
              settlementPeriodDays: platformSettings.settlementPeriodDays,
              payoutMinimumCoins: platformSettings.payoutMinimumCoins,
              payoutCoinValueCents: platformSettings.payoutCoinValueCents,
              payoutCurrency: platformSettings.payoutCurrency,
              minMovieCoinPrice: platformSettings.minMovieCoinPrice,
              maxMovieCoinPrice: platformSettings.maxMovieCoinPrice,
              minEpisodeCoinPrice: platformSettings.minEpisodeCoinPrice,
              maxEpisodeCoinPrice: platformSettings.maxEpisodeCoinPrice,
              minSceneCoinPrice: platformSettings.minSceneCoinPrice,
              maxSceneCoinPrice: platformSettings.maxSceneCoinPrice,
            }}
          />
        </section>

        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Promotional coins</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            Grant a fixed batch of coins to a user that expires automatically after a set number of days. Unspent
            coins from a grant are reclaimed the day it expires — this never affects coins the user purchased or
            earned.
          </p>
          <GrantPromotionalCoinsForm />
        </section>

        <section className="card mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Risk &amp; Trust</h2>
            {(fraudSignals.refundRisk.length > 0 || fraudSignals.velocityRisk.length > 0) && (
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                {fraudSignals.refundRisk.length + fraudSignals.velocityRisk.length} flagged
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-cinerra-muted">
            Two real signals computed from actual purchase history — not a fraud score or ML model. A refund isn&rsquo;t
            proof of abuse on its own, so these are for review, not automatic action; a creator watching their own
            paid content is never flagged here, since no money moves.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">High refund rate (3+ purchases, 50%+ refunded)</p>
            {fraudSignals.refundRisk.length === 0 ? (
              <p className="text-sm text-cinerra-muted">No accounts currently flagged.</p>
            ) : (
              <div className="flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
                {fraudSignals.refundRisk.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="text-cinerra-text">{u.name ?? u.email}</p>
                      <p className="text-xs text-cinerra-muted">
                        {u.refundedPurchases}/{u.totalPurchases} purchases refunded ({(u.refundRate * 100).toFixed(0)}%)
                        {u.accountStatus === "SUSPENDED" && " — suspended"}
                      </p>
                    </div>
                    <RiskUserActions email={u.email} accountStatus={u.accountStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Unusually fast repeat purchasing (5+ in 24h)</p>
            {fraudSignals.velocityRisk.length === 0 ? (
              <p className="text-sm text-cinerra-muted">No accounts currently flagged.</p>
            ) : (
              <div className="flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
                {fraudSignals.velocityRisk.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="text-cinerra-text">{u.name ?? u.email}</p>
                      <p className="text-xs text-cinerra-muted">
                        {u.purchaseCount} purchases in the last {u.windowHours}h
                        {u.accountStatus === "SUSPENDED" && " — suspended"}
                      </p>
                    </div>
                    <RiskUserActions email={u.email} accountStatus={u.accountStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Suspend an account directly</p>
            <p className="text-sm text-cinerra-muted">
              For accounts flagged some other way (a support ticket, a chargeback notice). A suspended account can&rsquo;t sign
              in, and any session it already has stops working on its very next request — not just at its next login.
            </p>
            <SuspendUserForm />
          </div>
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

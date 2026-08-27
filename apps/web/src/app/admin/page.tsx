import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/ai";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { ModerationQueue } from "@/components/ModerationQueue";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { PlanDoeAllowanceForm } from "@/components/admin/PlanDoeAllowanceForm";
import { GrantPromotionalCoinsForm } from "@/components/admin/GrantPromotionalCoinsForm";
import { DailyRevenueChart } from "@/components/admin/DailyRevenueChart";
import { RiskUserActions } from "@/components/admin/RiskUserActions";
import { SuspendUserForm } from "@/components/admin/SuspendUserForm";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { getRevenueAnalytics } from "@/lib/analytics";
import { getEngagementAnalytics } from "@/lib/viewingEvents";
import { getFraudSignals } from "@/lib/trustSafety";
import { listUsers } from "@/lib/userAdmin";

const CAPABILITIES = ["TEXT", "IMAGE", "VIDEO", "VOICE", "MUSIC", "SOUND_EFFECT"] as const;

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) redirect("/login");
  requireAcceptedTerms(session, "/admin");
  if (user.role !== "ADMIN") redirect("/");

  const [userCount, activeSubscriptions, jobStats, plans, recentJobs, pendingPublications, platformSettings, revenueAnalytics, engagementAnalytics, fraudSignals, usersPage] = await Promise.all([
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
    listUsers(),
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
  const flaggedCount = fraudSignals.refundRisk.length + fraudSignals.velocityRisk.length;

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={userCount} />
        <Stat label="Active subscriptions" value={activeSubscriptions.length} />
        <Stat label="MRR" value={`$${(mrrCents / 100).toFixed(0)}`} />
        <Stat label="Generation jobs" value={totalJobs} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-semibold">AI Providers</h2>
          <p className="mt-1 text-sm text-cinerra-muted">Configured via environment variables — never exposed to customers.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
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

        <section className="card">
          <h2 className="text-lg font-semibold">Generation success rate</h2>
          <p className="mt-1 text-sm text-cinerra-muted">
            {succeeded} succeeded / {failed} failed / {totalJobs} total
          </p>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Plans</p>
            <table className="w-full text-left text-sm">
              <thead className="text-cinerra-muted">
                <tr>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Monthly</th>
                  <th className="pb-2">Subscribers</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-cinerra-border">
                    <td className="py-1.5">{plan.name}</td>
                    <td className="py-1.5">${(plan.priceMonthlyCents / 100).toFixed(0)}</td>
                    <td className="py-1.5">{planDistribution.get(plan.name) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Recent generation jobs</h2>
        <div className="mt-3 max-h-96 overflow-y-auto">
          <div className="flex flex-col divide-y divide-cinerra-border">
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
        </div>
      </section>
    </div>
  );

  const moderationTab = (
    <section className="card">
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
  );

  const revenueTab = (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Revenue analytics</h2>
        <p className="mt-1 text-sm text-cinerra-muted">
          Computed from settled unlock transactions only. Conversion rate (viewers who watched vs. who paid) isn&rsquo;t shown here — nothing
          in the app writes view/impression events yet, so that number would be fabricated rather than real.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Doe revenue" value={`🪙 ${revenueAnalytics.totals.coinRevenue.toLocaleString()}`} />
          <Stat label="Publisher share" value={`🪙 ${revenueAnalytics.totals.publisherShare.toLocaleString()}`} />
          <Stat label="Platform share" value={`🪙 ${revenueAnalytics.totals.platformShare.toLocaleString()}`} />
          <Stat label="Avg revenue / viewer" value={`🪙 ${revenueAnalytics.totals.avgRevenuePerViewer.toFixed(1)}`} />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">Daily Doe revenue (last 30 days)</p>
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

      <section className="card">
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
    </div>
  );

  const coinEconomyTab = (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Doe economy settings</h2>
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
            doeCostPerReferenceImage: platformSettings.doeCostPerReferenceImage,
            doeCostPerVideoSecond: platformSettings.doeCostPerVideoSecond,
            doeCostPerTextGeneration: platformSettings.doeCostPerTextGeneration,
            doeCostPerVoice100Chars: platformSettings.doeCostPerVoice100Chars,
            doeCostPerAudioSecond: platformSettings.doeCostPerAudioSecond,
          }}
        />
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Plan Doe allowances</h2>
        <p className="mt-1 text-sm text-cinerra-muted">
          How much Doe each plan includes per month, granted as an expiring promotional balance on each billing
          cycle (or lazily, once a month, for the Free plan). Previously seed-only, direct database access.
        </p>
        <PlanDoeAllowanceForm
          initial={plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            priceMonthlyCents: plan.priceMonthlyCents,
            includedGenerationDoe: plan.includedGenerationDoe,
          }))}
        />
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Promotional Doe</h2>
        <p className="mt-1 text-sm text-cinerra-muted">
          Grant a fixed batch of Doe to a user that expires automatically after a set number of days. Unspent
          Doe from a grant are reclaimed the day it expires — this never affects Doe the user purchased or
          earned.
        </p>
        <GrantPromotionalCoinsForm />
      </section>
    </div>
  );

  const usersTab = (
    <section className="card">
      <h2 className="text-lg font-semibold">Users</h2>
      <p className="mt-1 text-sm text-cinerra-muted">
        Click a user to edit their profile, credit or debit their Doe balance, or suspend/unsuspend their account.
      </p>
      <div className="mt-4">
        <UserManagementTable
          initialUsers={usersPage.users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            status: u.status,
            walletBalance: u.walletBalance,
            createdAt: u.createdAt.toISOString(),
          }))}
          initialTotalCount={usersPage.totalCount}
          pageSize={usersPage.pageSize}
        />
      </div>
    </section>
  );

  const riskTab = (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Risk &amp; Trust</h2>
        {flaggedCount > 0 && (
          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300">{flaggedCount} flagged</span>
        )}
      </div>
      <p className="mt-1 text-sm text-cinerra-muted">
        Two real signals computed from actual purchase history — not a fraud score or ML model. A refund isn&rsquo;t
        proof of abuse on its own, so these are for review, not automatic action; a creator watching their own
        paid content is never flagged here, since no money moves.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
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

        <div>
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
  );

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 md:px-8">
          <h1 className="font-display text-2xl font-bold">Admin</h1>

          <AdminTabs
            tabs={[
              { key: "overview", label: "Overview", content: overviewTab },
              { key: "users", label: "Users", content: usersTab },
              { key: "moderation", label: "Moderation", badge: moderationQueueItems.length || undefined, content: moderationTab },
              { key: "revenue", label: "Revenue", content: revenueTab },
              { key: "coins", label: "Doe Economy", content: coinEconomyTab },
              { key: "risk", label: "Risk & Trust", badge: flaggedCount || undefined, content: riskTab },
            ]}
          />
        </main>
      </div>
      <MobileNav />
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

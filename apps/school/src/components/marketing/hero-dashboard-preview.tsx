import { Users, GraduationCap, ClipboardCheck, Wallet, Lock, UserPlus, CalendarClock, TrendingUp } from "lucide-react";

const STATS = [
  { label: "Total Students", value: "1,248", icon: Users, tint: "text-accent bg-accent-soft" },
  { label: "Teachers", value: "86", icon: GraduationCap, tint: "text-secondary bg-secondary-soft" },
  { label: "Attendance Today", value: "94%", icon: ClipboardCheck, tint: "text-success bg-success-soft" },
  { label: "Outstanding Fees", value: "₦2.4M", icon: Wallet, tint: "text-warning bg-warning-soft" },
];

const ATTENDANCE = [
  { day: "Mon", value: 88 },
  { day: "Tue", value: 91 },
  { day: "Wed", value: 95 },
  { day: "Thu", value: 90 },
  { day: "Fri", value: 94 },
  { day: "Sat", value: 40 },
  { day: "Sun", value: 12 },
];

const ACTIVITY = [
  { label: "Fee payment received", detail: "₦45,000 • JSS 2A", icon: Wallet },
  { label: "Attendance marked", detail: "Primary 4B • 32 students", icon: ClipboardCheck },
];

const EVENTS = [
  { label: "Mid-term examinations", detail: "Starts in 5 days" },
  { label: "Parent-teacher meeting", detail: "Sat, 10:00 AM" },
];

/// The hero's product preview — a static, illustrative mock of a
/// Winfield dashboard (not a live embed of /dashboard, which requires
/// auth and real school data). Every number here is sample content for
/// the mockup, matching the shape of the real dashboard's stat cards.
export function HeroDashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
      {/* Ambient glow behind the frame */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 scale-95 rounded-[2rem] bg-gradient-to-br from-accent/20 via-accent/5 to-secondary/10 blur-2xl"
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_60px_-15px_rgba(19,26,43,0.25)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border bg-muted-surface px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-md bg-surface px-3 py-1 text-xs text-muted">
            <Lock className="h-3 w-3" />
            app.winfield.school
          </div>
        </div>

        {/* Dashboard body */}
        <div className="space-y-5 bg-gradient-to-b from-background to-surface p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Wednesday, 12 March</p>
              <h3 className="text-base font-semibold text-foreground sm:text-lg">Good morning, Administrator</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              A
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-3.5">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${stat.tint}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Insights row */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Attendance</p>
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  94%
                </span>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {ATTENDANCE.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="w-full rounded-sm bg-accent-soft" style={{ height: "5rem" }}>
                      <div
                        className="w-full rounded-sm bg-accent"
                        style={{ height: `${d.value}%`, marginTop: `${100 - d.value}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Revenue Summary</p>
              <p className="text-xl font-semibold text-foreground">₦18.6M</p>
              <p className="mb-3 text-xs text-muted">Collected this term</p>
              <div className="mb-1.5 flex h-2 w-full overflow-hidden rounded-full bg-warning-soft">
                <div className="h-full w-[88%] rounded-full bg-accent" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">88% collected</span>
                <span className="font-medium text-warning">₦2.4M pending</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Recent Activity</p>
              <ul className="space-y-2.5">
                {ACTIVITY.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
                      <p className="truncate text-[11px] text-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mb-2 mt-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Upcoming</p>
              <ul className="space-y-2.5">
                {EVENTS.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary-soft text-secondary">
                      <CalendarClock className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
                      <p className="truncate text-[11px] text-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent cards — desktop only, to keep the hero calm on mobile */}
      <div
        aria-hidden
        className="animate-float absolute -right-6 -top-6 hidden w-52 rotate-3 rounded-xl border border-border bg-surface p-3.5 shadow-xl lg:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success">
            <ClipboardCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">94% Today</p>
            <p className="text-xs text-muted">Attendance</p>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="animate-float-delayed absolute -bottom-7 -left-8 hidden w-56 -rotate-2 rounded-xl border border-border bg-surface p-3.5 shadow-xl lg:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">₦850,000</p>
            <p className="text-xs text-muted">Payments received</p>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="animate-float absolute -right-10 bottom-10 hidden w-56 rotate-2 rounded-xl border border-border bg-surface p-3.5 shadow-xl xl:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-soft text-secondary">
            <UserPlus className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">New student</p>
            <p className="text-xs text-muted">Registration completed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

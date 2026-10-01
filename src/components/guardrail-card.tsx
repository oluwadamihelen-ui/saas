import { AlertOctagon, ShieldCheck } from "lucide-react";
import { Card, CardHeader, Progress } from "@/components/ui";
import type { GuardrailStatus } from "@/lib/engine/guardrail";
import { cn, money } from "@/lib/utils";

export function GuardrailCard({ g, currency, maxTrades, tradesToday, openRisk, balance }: { g: GuardrailStatus; currency: string; maxTrades: number; tradesToday: number; openRisk: number; balance: number }) {
  const stop = g.state === "STOP";
  return (
    <Card className={cn(stop && "border-down/60")}>
      <CardHeader title={<><ShieldCheck size={15} className="text-accent" /> Daily risk guardrail</>} hint="Your own rules, tracked for you. RiskPilot cannot block your broker — it shows you where you stand." />
      <div className="space-y-5 p-4">
        {g.messages.length > 0 && (
          <div role="alert" className={cn("flex gap-3 rounded-lg p-3 text-sm", stop ? "bg-down-soft text-down" : "bg-warn-soft text-warn")}>
            {stop && <AlertOctagon size={18} className="mt-0.5 shrink-0" />}
            <div className="space-y-0.5">{g.messages.map((m, i) => <p key={i} className={i === 0 ? "font-semibold" : ""}>{m}</p>)}</div>
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-muted">Daily loss</span>
            <span className="num font-medium">-{money(g.dailyLossUsed, currency, { decimals: 2 })} <span className="text-muted">/ -{money(g.dailyLimitAmount, currency, { decimals: 2 })}</span></span>
          </div>
          <Progress value={g.dailyUsedPercent} />
          <div className="mt-1.5 flex justify-between text-xs text-muted"><span>{Math.round(g.dailyUsedPercent)}% used</span><span>Remaining risk: <b className="num text-fg">{money(g.dailyRemaining, currency, { decimals: 2 })}</b></span></div>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-muted">Trades today</span>
            <span className="num font-medium">{tradesToday} <span className="text-muted">/ {maxTrades}</span></span>
          </div>
          <Progress value={(tradesToday / maxTrades) * 100} />
          <div className="mt-1.5 text-xs text-muted">{g.tradesRemaining} trade{g.tradesRemaining === 1 ? "" : "s"} left in your allowance</div>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-muted">Weekly loss</span>
            <span className="num font-medium">-{money(g.weeklyLossUsed, currency, { decimals: 2 })} <span className="text-muted">/ -{money(g.weeklyLimitAmount, currency, { decimals: 2 })}</span></span>
          </div>
          <Progress value={g.weeklyUsedPercent} />
        </div>
        {g.challenge?.enabled && g.challenge.floor !== null && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-muted">Max drawdown ({g.challenge.drawdownType === "TRAILING" ? "trailing" : "fixed"})</span>
              <span className="num font-medium">{Math.round(g.challenge.drawdownUsedPercent)}% <span className="text-muted">used</span></span>
            </div>
            <Progress value={g.challenge.drawdownUsedPercent} />
            <div className="mt-1.5 flex justify-between text-xs text-muted"><span>Floor <b className="num text-fg">{money(g.challenge.floor, currency, { decimals: 2 })}</b></span><span>Room left <b className="num text-fg">{money(g.challenge.room ?? 0, currency, { decimals: 2 })}</b></span></div>
          </div>
        )}
        {g.challenge?.target != null && g.challenge.targetProgressPercent !== null && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-muted">Profit target</span>
              <span className="num font-medium">{Math.min(100, Math.round(g.challenge.targetProgressPercent))}% <span className="text-muted">of {money(g.challenge.target, currency)}</span>{g.challenge.targetReached && <span className="ml-1.5 text-up">· reached</span>}</span>
            </div>
            <Progress value={g.challenge.targetProgressPercent} tone="up" />
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-3 text-xs text-muted">
          <span>Open risk <b className="num text-fg">{money(openRisk, currency, { decimals: 2 })}</b> ({balance > 0 ? ((openRisk / balance) * 100).toFixed(1) : "0"}%)</span>
          <span>Risk taken today <b className="num text-fg">{g.riskTodayPercent}%</b></span>
        </div>
      </div>
    </Card>
  );
}

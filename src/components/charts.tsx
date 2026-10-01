"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#22c55e", RED = "#f43f5e", BLUE = "#3b82f6", GRID = "#232c3d";
const tip = { contentStyle: { background: "#171d2a", border: "1px solid #232c3d", borderRadius: 8, fontSize: 12, color: "#e8ecf3" }, labelStyle: { color: "#8b95a8" }, cursor: { fill: "rgba(255,255,255,0.04)" } };

function Frame({ children, height = 220 }: { children: React.ReactElement; height?: number }) {
  return <div style={{ height }} className="w-full"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}
export function NoData({ text = "Not enough data yet." }: { text?: string }) {
  return <div className="grid h-48 place-items-center text-sm text-muted">{text}</div>;
}
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v * 100) / 100));

export function EquityChart({ data }: { data: { label: string; equity: number }[] }) {
  if (data.length < 2) return <NoData />;
  const idx = data.map((d, i) => ({ ...d, i }));
  return (
    <Frame>
      <AreaChart data={idx} margin={{ left: -8, right: 8, top: 8 }}>
        <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.35} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="i" tick={false} axisLine={false} height={8} />
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} width={52} domain={["auto", "auto"]} />
        <Tooltip {...tip} formatter={(v) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }), "Balance"]} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
        <Area isAnimationActive={false} type="monotone" dataKey="equity" stroke={BLUE} strokeWidth={2} fill="url(#eq)" />
      </AreaChart>
    </Frame>
  );
}

export function DrawdownChart({ data }: { data: { label: string; dd: number }[] }) {
  if (data.length < 2) return <NoData />;
  const idx = data.map((d, i) => ({ ...d, i }));
  return (
    <Frame>
      <AreaChart data={idx} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="i" tick={false} axisLine={false} height={8} />
        <YAxis tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={48} />
        <Tooltip {...tip} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
        <Area isAnimationActive={false} type="monotone" dataKey="dd" stroke={RED} strokeWidth={2} fill={RED} fillOpacity={0.18} />
      </AreaChart>
    </Frame>
  );
}

export function PnlByDayChart({ data }: { data: { day: string; pnl: number }[] }) {
  if (!data.length) return <NoData />;
  return (
    <Frame>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} width={52} />
        <ReferenceLine y={0} stroke="#3a4560" />
        <Tooltip {...tip} formatter={(v) => [Number(v).toFixed(2), "P&L"]} />
        <Bar isAnimationActive={false} dataKey="pnl" radius={[3, 3, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? GREEN : RED} />)}</Bar>
      </BarChart>
    </Frame>
  );
}

export function RiskPerTradeChart({ data, limit }: { data: { n: number; risk: number; win: boolean }[]; limit?: number }) {
  if (!data.length) return <NoData />;
  return (
    <Frame>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="n" axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={44} />
        {limit !== undefined && <ReferenceLine y={limit} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "your max", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }} />}
        <Tooltip {...tip} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Risk"]} labelFormatter={(n) => `Trade #${n}`} />
        <Bar isAnimationActive={false} dataKey="risk" radius={[3, 3, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.win ? GREEN : RED} fillOpacity={0.85} />)}</Bar>
      </BarChart>
    </Frame>
  );
}

export function DistributionChart({ data }: { data: { label: string; count: number; negative: boolean }[] }) {
  if (!data.some((d) => d.count)) return <NoData />;
  return (
    <Frame>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={36} />
        <Tooltip {...tip} formatter={(v) => [v, "Trades"]} />
        <Bar isAnimationActive={false} dataKey="count" radius={[3, 3, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.negative ? RED : GREEN} />)}</Bar>
      </BarChart>
    </Frame>
  );
}

export function GroupBarChart({ data, valueKey, suffix = "" }: { data: { key: string; value: number }[]; valueKey: string; suffix?: string }) {
  if (!data.length) return <NoData />;
  return (
    <Frame height={Math.max(140, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={compact} />
        <YAxis type="category" dataKey="key" axisLine={false} tickLine={false} width={72} />
        <ReferenceLine x={0} stroke="#3a4560" />
        <Tooltip {...tip} formatter={(v) => [`${Number(v).toFixed(2)}${suffix}`, valueKey]} />
        <Bar isAnimationActive={false} dataKey="value" radius={[0, 3, 3, 0]}>{data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? GREEN : RED} />)}</Bar>
      </BarChart>
    </Frame>
  );
}

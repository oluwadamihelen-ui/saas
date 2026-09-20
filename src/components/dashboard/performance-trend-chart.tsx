"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Dot } from "recharts";

export interface PerformanceTrendPoint {
  label: string;
  average: number | null;
}

/// A single series (this student's own overall average over time), so no
/// legend is needed — the card title already names what's plotted. Color
/// comes from the app's own --accent token (not a hardcoded hex) so the
/// chart follows the same light/dark theme as everything else.
export function PerformanceTrendChart({ points }: { points: PerformanceTrendPoint[] }) {
  const data = points.map((p) => ({ ...p, average: p.average ?? null }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={0}
            angle={data.length > 4 ? -20 : 0}
            textAnchor={data.length > 4 ? "end" : "middle"}
            height={data.length > 4 ? 40 : 24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            formatter={(value) => [typeof value === "number" ? `${value}%` : "No data", "Average"]}
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={<Dot r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

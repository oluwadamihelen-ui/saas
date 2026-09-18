"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export interface PaymentTrendPoint {
  label: string;
  amountMinor: number;
}

/// Weekly confirmed-payment totals for one term only — never spans terms
/// (see financial-health.ts). A bar chart, not a line, since each bucket
/// is a discrete sum rather than a continuous measurement.
export function PaymentTrendChart({ points, currency }: { points: PaymentTrendPoint[]; currency: string }) {
  const data = points.map((p) => ({ ...p, amount: p.amountMinor / 100 }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${currency} ${v}`} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            formatter={(value) => [`${currency} ${value}`, "Collected"]}
          />
          <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

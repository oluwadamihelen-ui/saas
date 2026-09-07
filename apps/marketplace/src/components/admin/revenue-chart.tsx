"use client";

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function RevenueChart({ data }: { data: { date: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4338ca" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4338ca" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e6eb" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          tick={{ fontSize: 11, fill: "#667085" }}
          axisLine={false}
          tickLine={false}
          interval={Math.ceil(data.length / 6)}
        />
        <YAxis tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} width={50} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
          labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
          contentStyle={{ borderRadius: 8, border: "1px solid #e4e6eb", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="amount" stroke="#4338ca" strokeWidth={2} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

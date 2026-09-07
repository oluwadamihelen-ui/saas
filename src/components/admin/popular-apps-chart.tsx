"use client";

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function PopularAppsChart({ data }: { data: { name: string; sales: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e6eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} width={140} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e6eb", fontSize: 12 }} />
        <Bar dataKey="sales" fill="#4338ca" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS: Record<string, string> = {
  AVAILABLE: "#0d8a4f",
  RESERVED: "#4338ca",
  OCCUPIED: "#b45309",
  DIRTY: "#c81e3a",
  CLEANING: "#7c6ae8",
  INSPECTED: "#0891b2",
  MAINTENANCE: "#6b7280",
  OUT_OF_SERVICE: "#111827",
};

export function RoomStatusChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({ name: status.replaceAll("_", " "), status, value }));

  if (data.length === 0) return <p className="py-16 text-center text-sm text-muted">No rooms yet.</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.status} fill={COLORS[d.status] ?? "#999"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

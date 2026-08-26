// Plain CSS bars — no charting dependency for a single 30-point sparkline.
export function DailyRevenueChart({ data }: { data: { date: string; coins: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.coins));

  return (
    <div className="flex h-24 items-end gap-0.5">
      {data.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.coins.toLocaleString()} Doe`}
          className="flex-1 rounded-t bg-cinerra-accent/70 transition hover:bg-cinerra-accent"
          style={{ height: `${Math.max(2, (d.coins / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlanRow {
  id: string;
  name: string;
  priceMonthlyCents: number;
  includedGenerationDoe: number;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}/mo`;
}

export function PlanDoeAllowanceForm({ initial }: { initial: PlanRow[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(initial.map((p) => [p.id, p.includedGenerationDoe])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(planId: string, raw: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [planId]: Number(raw) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plans: initial.map((p) => ({ planId: p.id, includedGenerationDoe: values[p.id] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save plan allowances.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save plan allowances.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-cinerra-muted">
          <tr>
            <th className="pb-2">Plan</th>
            <th className="pb-2">Price</th>
            <th className="pb-2">Included Doe / month</th>
          </tr>
        </thead>
        <tbody>
          {initial.map((plan) => (
            <tr key={plan.id} className="border-t border-cinerra-border">
              <td className="py-2 font-medium">{plan.name}</td>
              <td className="py-2 text-cinerra-muted">{formatPrice(plan.priceMonthlyCents)}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  value={values[plan.id]}
                  onChange={(e) => update(plan.id, e.target.value)}
                  className="input w-32"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary-sm">
          {saving ? "Saving…" : "Save allowances"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}

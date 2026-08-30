"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type Customer = {
  id: string;
  name: string | null;
  phone: string;
  createdAt: string;
  stats: { totalOrders: number; totalSpent: number; lastOrderAt: string | null };
};

function segmentFor(c: Customer): { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" } {
  if (c.stats.totalSpent >= 200_000) return { label: "VIP", variant: "success" };
  if (c.stats.totalOrders === 0) return { label: "New", variant: "outline" };
  const daysSinceLast = c.stats.lastOrderAt
    ? (Date.now() - new Date(c.stats.lastOrderAt).getTime()) / 86_400_000
    : Infinity;
  if (daysSinceLast > 60) return { label: "Inactive", variant: "secondary" };
  if (c.stats.totalOrders > 1) return { label: "Returning", variant: "default" };
  return { label: "New", variant: "outline" };
}

export function CustomersClient({ currency, customers }: { currency: string; customers: Customer[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return customers;
    const needle = q.toLowerCase();
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(needle) || c.phone.includes(needle)
    );
  }, [q, customers]);

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No customers yet."
        description="Customers are created automatically the moment someone places an order."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Lifetime value</TableHead>
            <TableHead>Last order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => {
            const segment = segmentFor(c);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium">{c.name ?? "Unnamed customer"}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={segment.variant}>{segment.label}</Badge>
                </TableCell>
                <TableCell>{c.stats.totalOrders}</TableCell>
                <TableCell className="font-medium">{formatCurrency(c.stats.totalSpent, currency)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.stats.lastOrderAt ? formatDistanceToNow(new Date(c.stats.lastOrderAt), { addSuffix: true }) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

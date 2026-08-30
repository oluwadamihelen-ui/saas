"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SEQUENTIAL_BLUE = "#2a78d6";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {p.name}: <span className="font-medium text-foreground">{formatCurrency(p.value, currency)}</span>
        </p>
      ))}
    </div>
  );
}

export function AnalyticsCharts({
  currency,
  series,
  topProducts,
  categories,
  segments,
}: {
  currency: string;
  series: { date: string; revenue: number; orders: number }[];
  topProducts: { productName: string; revenue: number; unitsSold: number }[];
  categories: { category: string; revenue: number }[];
  segments: { vip: number; returning: number; new: number; inactive: number };
}) {
  const segmentData = [
    { name: "VIP", value: segments.vip },
    { name: "Returning", value: segments.returning },
    { name: "New", value: segments.new },
    { name: "Inactive", value: segments.inactive },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue trend</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {series.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid vertical={false} stroke={GRIDLINE} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRIDLINE }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatCurrency(v, currency)} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top products</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {topProducts.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} stroke={GRIDLINE} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, currency)} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Bar dataKey="revenue" name="Revenue" fill={SEQUENTIAL_BLUE} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by category</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {categories.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories}>
                <CartesianGrid vertical={false} stroke={GRIDLINE} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRIDLINE }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, currency)} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} barSize={28}>
                  {categories.map((_, i) => (
                    <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Customer segments</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={segmentData}>
              <CartesianGrid vertical={false} stroke={GRIDLINE} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRIDLINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{label}</p>
                      <p className="text-muted-foreground">{payload[0].value} customers</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" name="Customers" radius={[4, 4, 0, 0]} barSize={40}>
                {segmentData.map((_, i) => (
                  <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Not enough data yet.</div>;
}

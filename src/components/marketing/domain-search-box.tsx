"use client";

import * as React from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  currency: string;
}

export function DomainSearchBox() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<DomainResult[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/domains/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="mybusiness"
            className="h-12 pl-9"
            aria-label="Search for a domain name"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {results && (
        <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {results.map((r) => (
            <div key={r.domain} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                {r.available ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-danger" />
                )}
                <div>
                  <p className="font-medium text-foreground">{r.domain}</p>
                  <p className="text-xs text-muted">
                    {r.available ? "Available" : "Taken"} · Renews at {formatCurrency(r.renewalPrice, r.currency)}/yr
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(r.registrationPrice, r.currency)}
                </span>
                {r.available ? (
                  <Button asChild size="sm" variant="primary">
                    <Link href={`/dashboard/domains/register?domain=${encodeURIComponent(r.domain)}`}>Select</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    Unavailable
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

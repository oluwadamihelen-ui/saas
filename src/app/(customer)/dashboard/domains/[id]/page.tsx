import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DnsRecordForm } from "./dns-record-form";
import { deleteDnsRecord, requestDomainRenewal, setAutoRenew } from "../actions";

export default async function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id, customerId: user.id },
    include: {
      dnsRecords: { orderBy: { createdAt: "asc" } },
      domainOrders: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!domain) notFound();

  const deleteRecord = deleteDnsRecord.bind(null, domain.id);
  const renewOneYear = requestDomainRenewal.bind(null, domain.id, 1);
  const enableAutoRenew = setAutoRenew.bind(null, domain.id, true);
  const disableAutoRenew = setAutoRenew.bind(null, domain.id, false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{domain.name}</h1>
          <p className="mt-1 text-sm text-muted">Registrar: {domain.registrarProvider}</p>
        </div>
        <StatusBadge status={domain.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-foreground">Registration</p>
            <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted">
              <dt>Registered</dt>
              <dd className="text-foreground">{domain.registeredAt ? formatDate(domain.registeredAt) : "—"}</dd>
              <dt>Expires</dt>
              <dd className="text-foreground">{domain.expiresAt ? formatDate(domain.expiresAt) : "—"}</dd>
              <dt>Auto-renew</dt>
              <dd className="text-foreground">{domain.autoRenew ? "On" : "Off"}</dd>
              <dt>Nameservers</dt>
              <dd className="text-foreground">{domain.nameservers.join(", ") || "—"}</dd>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={renewOneYear}>
                <Button size="sm" type="submit">
                  Renew Now (1 yr)
                </Button>
              </form>
              {domain.autoRenew ? (
                <form action={disableAutoRenew}>
                  <Button size="sm" variant="secondary" type="submit">
                    Turn off auto-renew
                  </Button>
                </form>
              ) : (
                <form action={enableAutoRenew}>
                  <Button size="sm" variant="secondary" type="submit">
                    Turn on auto-renew
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent>
              <p className="mb-4 text-sm font-semibold text-foreground">DNS Records</p>
              {domain.dnsRecords.length === 0 ? (
                <p className="mb-4 text-sm text-muted">No DNS records yet.</p>
              ) : (
                <div className="mb-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">TTL</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {domain.dnsRecords.map((record) => (
                        <tr key={record.id}>
                          <td className="px-3 py-2 font-mono text-xs">{record.type}</td>
                          <td className="px-3 py-2">{record.name}</td>
                          <td className="max-w-[220px] truncate px-3 py-2 text-muted" title={record.value}>
                            {record.value}
                          </td>
                          <td className="px-3 py-2 text-muted">{record.ttl}s</td>
                          <td className="px-3 py-2 text-right">
                            <form action={deleteRecord.bind(null, record.id)}>
                              <Button size="sm" variant="ghost" type="submit">
                                Delete
                              </Button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DnsRecordForm domainId={domain.id} />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-4 text-sm font-semibold text-foreground">Order History</p>
              {domain.domainOrders.length === 0 ? (
                <EmptyState title="No orders yet" description="Registration and renewal orders for this domain will appear here." />
              ) : (
                <div className="space-y-2 text-sm">
                  {domain.domainOrders.map((domainOrder) => (
                    <div key={domainOrder.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {domainOrder.action} · {domainOrder.years} {domainOrder.years === 1 ? "year" : "years"}
                        </p>
                        <p className="text-xs text-muted">{formatDate(domainOrder.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted">{formatCurrency(Number(domainOrder.customerPrice), "USD")}</span>
                        <StatusBadge status={domainOrder.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

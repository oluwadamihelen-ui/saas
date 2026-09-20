import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { requireBuyer } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { brand } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PayBuyerInvoiceButton } from "./widgets";

export const metadata: Metadata = { title: "Buyer Dashboard" };

const AGREEMENT_STATUS_VARIANT = { PENDING: "warning", ACTIVE: "success", COMPLETED: "neutral", CANCELLED: "danger" } as const;
const INVOICE_STATUS_VARIANT = { PENDING: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" } as const;

const STAGE_ORDER = ["ORDER_CONFIRMED", "IN_DEVELOPMENT", "INSTALLATION", "DELIVERED"] as const;
const STAGE_LABEL: Record<(typeof STAGE_ORDER)[number], string> = {
  ORDER_CONFIRMED: "Order confirmed",
  IN_DEVELOPMENT: "In development",
  INSTALLATION: "Installation",
  DELIVERED: "Delivered",
};

export default async function BuyerDashboardPage() {
  const sessionUser = await requireBuyer();
  const buyer = await prisma.buyer.findUniqueOrThrow({
    where: { userId: sessionUser.id },
    include: {
      agreements: {
        include: { progressUpdates: { orderBy: { postedAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });

  const activeAgreement = buyer.agreements.find((a) => a.status === "ACTIVE") ?? buyer.agreements[0] ?? null;
  const currentStageIndex = activeAgreement ? STAGE_ORDER.indexOf(activeAgreement.progressStage) : -1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome, {buyer.displayName}</h1>
        <p className="text-sm text-muted">Your Schoolum purchase, in one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Explore Schoolum</CardTitle>
          <CardDescription>A live demo environment with logins seeded for every role, so you can look around.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={brand.demoUrl} target="_blank" rel="noreferrer">
              Open demo <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your order
            {activeAgreement && <Badge variant={AGREEMENT_STATUS_VARIANT[activeAgreement.status]}>{activeAgreement.status}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!activeAgreement ? (
            <EmptyState title="No order on record yet" description="Your Schoolum team will set this up once your order is confirmed." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {STAGE_ORDER.map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {i <= currentStageIndex ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted" />
                      )}
                      <span className={`text-sm ${i <= currentStageIndex ? "font-medium text-foreground" : "text-muted"}`}>
                        {STAGE_LABEL[stage]}
                      </span>
                    </div>
                    {i < STAGE_ORDER.length - 1 && <div className="h-px w-6 bg-border" />}
                  </div>
                ))}
              </div>

              {activeAgreement.progressUpdates.length === 0 ? (
                <EmptyState title="No progress updates yet" />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Progress log</p>
                  {activeAgreement.progressUpdates.map((update) => (
                    <div key={update.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{STAGE_LABEL[update.stage]}</span>
                        <span className="text-xs text-muted">{formatDateTime(update.postedAt)}</span>
                      </div>
                      {update.note && <p className="mt-1 text-muted">{update.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>
          {buyer.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyer.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.description ?? "—"}</TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, inv.currency)}</TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell><Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right">{inv.status === "PENDING" && <PayBuyerInvoiceButton invoiceId={inv.id} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted">
        Questions about your order?{" "}
        <Link href="/contact" className="font-medium text-accent hover:underline">
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}

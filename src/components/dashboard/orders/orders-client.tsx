"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/dashboard/orders/order-status-badge";
import { formatDistanceToNow } from "date-fns";

const STATUSES = ["PENDING", "CONFIRMED", "PAID", "PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
  customer: { name: string | null; phone: string };
  items: { productName: string; quantity: number }[];
};
type Product = { id: string; name: string; price: string; stockQuantity: number };

export function OrdersClient({
  businessId,
  currency,
  initialOrders,
  products,
}: {
  businessId: string;
  currency: string;
  initialOrders: Order[];
  products: Product[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [lineItems, setLineItems] = useState<{ productId: string; quantity: string }[]>([
    { productId: "", quantity: "1" },
  ]);

  async function updateStatus(orderId: string, status: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not update order");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    toast.success("Order updated");
  }

  function addLine() {
    setLineItems((prev) => [...prev, { productId: "", quantity: "1" }]);
  }

  function removeLine(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function createOrder() {
    setSaving(true);
    try {
      const items = lineItems
        .filter((l) => l.productId && Number(l.quantity) > 0)
        .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, customerPhone, customerName, deliveryAddress, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create order");
        return;
      }
      setOrders((prev) => [data.order, ...prev]);
      toast.success(`Order ${data.order.orderNumber} created`);
      setOpen(false);
      setCustomerPhone("");
      setCustomerName("");
      setDeliveryAddress("");
      setLineItems([{ productId: "", quantity: "1" }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every order, from every channel.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New order
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your first order will appear here." description="Orders from WhatsApp, your storefront, or the dashboard all show up in one place." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderNumber}</TableCell>
                <TableCell>{o.customer.name ?? o.customer.phone}</TableCell>
                <TableCell className="text-muted-foreground">
                  {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                </TableCell>
                <TableCell>{formatCurrency(o.total, currency)}</TableCell>
                <TableCell>
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue>
                        <OrderStatusBadge status={o.status} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+2348012345678" />
              </div>
              <div className="space-y-2">
                <Label>Customer name (optional)</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Delivery address (optional)</Label>
              <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
              {lineItems.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <Select value={line.productId} onValueChange={(v) => setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, productId: v } : l)))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.price, currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={line.quantity}
                    onChange={(e) => setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createOrder} disabled={saving || !customerPhone}>
              {saving ? "Creating…" : "Create order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

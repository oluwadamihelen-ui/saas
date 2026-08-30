"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatDistanceToNow } from "date-fns";

type Product = { id: string; name: string; stockQuantity: number; lowStockThreshold: number };
type Movement = {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  product: { name: string };
};

export function InventoryClient({
  businessId,
  products,
  movements: initialMovements,
}: {
  businessId: string;
  products: Product[];
  movements: Movement[];
}) {
  const [movements, setMovements] = useState(initialMovements);
  const [productList, setProductList] = useState(products);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: "", type: "STOCK_ADDED", quantity: "", note: "" });

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          productId: form.productId,
          type: form.type,
          quantity: Number(form.quantity),
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not adjust stock");
        return;
      }
      const product = productList.find((p) => p.id === form.productId);
      if (product) {
        setProductList((prev) =>
          prev.map((p) => (p.id === form.productId ? { ...p, stockQuantity: data.newQuantity } : p))
        );
        setMovements((prev) => [
          {
            id: data.movement.id,
            type: form.type,
            quantity: data.movement.quantity,
            note: form.note || null,
            createdAt: new Date().toISOString(),
            product: { name: product.name },
          },
          ...prev,
        ]);
      }
      toast.success("Stock updated");
      setOpen(false);
      setForm({ productId: "", type: "STOCK_ADDED", quantity: "", note: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stock movements</h2>
        <Button onClick={() => setOpen(true)}>Adjust stock</Button>
      </div>

      {movements.length === 0 ? (
        <EmptyState icon={Boxes} title="No inventory movements yet." description="Stock changes will appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.product.name}</TableCell>
                <TableCell>
                  <Badge variant={m.quantity < 0 ? "destructive" : "success"}>{m.type}</Badge>
                </TableCell>
                <TableCell className={m.quantity < 0 ? "text-red-600" : "text-emerald-600"}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {productList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.stockQuantity} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Movement type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK_ADDED">Stock added</SelectItem>
                  <SelectItem value="STOCK_REMOVED">Stock removed</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Delivery from supplier" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !form.productId || !form.quantity}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

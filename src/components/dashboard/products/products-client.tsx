"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  costPrice: string | null;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  category: { name: string } | null;
};

const emptyForm = {
  id: "",
  name: "",
  description: "",
  price: "",
  costPrice: "",
  sku: "",
  stockQuantity: "",
  lowStockThreshold: "10",
  categoryName: "",
};

export function ProductsClient({
  businessId,
  currency,
  initialProducts,
}: {
  businessId: string;
  currency: string;
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const editing = Boolean(form.id);

  function openCreate() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      costPrice: p.costPrice ?? "",
      sku: p.sku ?? "",
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold),
      categoryName: p.category?.name ?? "",
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        businessId,
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price || 0),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        sku: form.sku || undefined,
        stockQuantity: Number(form.stockQuantity || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 10),
        categoryName: form.categoryName || undefined,
      };

      const res = await fetch(editing ? `/api/products/${form.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save product");
        return;
      }

      if (editing) {
        setProducts((prev) => prev.map((p) => (p.id === form.id ? { ...p, ...data.product, category: form.categoryName ? { name: form.categoryName } : null } : p)));
      } else {
        setProducts((prev) => [{ ...data.product, category: form.categoryName ? { name: form.categoryName } : null }, ...prev]);
      }
      toast.success(editing ? "Product updated" : "Product added");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const res = await fetch(`/api/products/${id}?businessId=${businessId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Could not delete product");
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Product deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your catalog.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="You haven't added any products yet."
          description="Add your first product to start selling."
          action={<Button onClick={openCreate}>Add your first product</Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium">{p.name}</p>
                  {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                </TableCell>
                <TableCell>{p.category?.name ?? "—"}</TableCell>
                <TableCell>{formatCurrency(p.price, currency)}</TableCell>
                <TableCell>
                  <span className={p.stockQuantity <= p.lowStockThreshold ? "text-amber-600 font-medium" : ""}>
                    {p.stockQuantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "Active" : "Disabled"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ({currency})</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cost price ({currency})</Label>
                <Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock quantity</Label>
                <Input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Low-stock threshold</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} placeholder="e.g. Rice" />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.price}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

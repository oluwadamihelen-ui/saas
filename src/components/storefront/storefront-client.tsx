"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, MessageCircle, Minus, Plus, X, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { MamaLogo } from "@/components/brand/logo";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  stockQuantity: number;
  primaryImageUrl: string | null;
  category: { id: string; name: string } | null;
};

type CartLine = { productId: string; name: string; price: number; quantity: number };

export function StorefrontClient({
  business,
  categories,
  products,
  viewerWallet,
}: {
  business: { slug: string; name: string; category: string; currency: string; phone: string; logoUrl: string | null; coverImageUrl: string | null };
  categories: { id: string; name: string }[];
  products: Product[];
  viewerWallet: { businessId: string; balance: string; currency: string } | null;
}) {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [payingWithWallet, setPayingWithWallet] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  const filtered = useMemo(
    () => (activeCategory === "all" ? products : products.filter((p) => p.category?.id === activeCategory)),
    [products, activeCategory]
  );

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { productId: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
    toast.success(`${p.name} added to cart`);
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  async function createOrder() {
    const res = await fetch("/api/storefront/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessSlug: business.slug,
        customerPhone: form.phone,
        customerName: form.name,
        deliveryAddress: form.address,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not place order");
      return null;
    }
    return data.order as { id: string };
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const order = await createOrder();
      if (!order) return;

      const payRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        // Order was created but payment isn't configured — send them to the order page anyway.
        window.location.href = `/shop/${business.slug}/order/${order.id}`;
        return;
      }
      window.location.href = payData.authorizationUrl;
    } finally {
      setPlacing(false);
    }
  }

  async function placeOrderWithWallet() {
    if (!viewerWallet) return;
    setPayingWithWallet(true);
    try {
      const order = await createOrder();
      if (!order) return;

      const res = await fetch("/api/wallet/pay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, buyerBusinessId: viewerWallet.businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not pay with wallet balance");
        window.location.href = `/shop/${business.slug}/order/${order.id}`;
        return;
      }
      toast.success("Paid with your MAMA wallet balance");
      window.location.href = `/shop/${business.slug}/order/${order.id}`;
    } finally {
      setPayingWithWallet(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{business.category}</p>
            <h1 className="text-xl font-bold">{business.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <a href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCartOpen(true)} className="relative">
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${activeCategory === "all" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${activeCategory === c.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No products available right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="flex aspect-square items-center justify-center bg-secondary text-muted-foreground">
                  {p.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs">No image</span>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="mt-1 font-semibold">{formatCurrency(p.price, business.currency)}</p>
                  {p.stockQuantity <= 0 ? (
                    <Badge variant="secondary" className="mt-2">Out of stock</Badge>
                  ) : (
                    <Button size="sm" className="mt-2 w-full" onClick={() => addToCart(p)}>
                      Add to cart
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Powered by <MamaLogo className="inline-flex text-xs" />
      </footer>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your cart</DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(c.price, business.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.productId, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-4 text-center text-sm">{c.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.productId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(c.productId, -c.quantity)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-3 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(cartTotal, business.currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="w-full"
              disabled={cart.length === 0}
              onClick={() => {
                setCartOpen(false);
                setCheckoutOpen(true);
              }}
            >
              Checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2348012345678" />
            </div>
            <div className="space-y-2">
              <Label>Delivery address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <p className="text-sm font-medium">Total: {formatCurrency(cartTotal, business.currency)}</p>
            {viewerWallet && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-primary">
                  <Wallet className="h-4 w-4" /> MAMA wallet balance: {formatCurrency(viewerWallet.balance, viewerWallet.currency)}
                </p>
                {Number(viewerWallet.balance) < cartTotal && (
                  <p className="mt-1 text-xs text-muted-foreground">Not enough balance to cover this order with your wallet.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={placeOrder} disabled={placing || payingWithWallet || !form.name || !form.phone}>
              {placing ? "Placing order…" : "Pay now"}
            </Button>
            {viewerWallet && Number(viewerWallet.balance) >= cartTotal && (
              <Button
                variant="outline"
                className="w-full"
                onClick={placeOrderWithWallet}
                disabled={placing || payingWithWallet || !form.name || !form.phone}
              >
                <Wallet className="h-4 w-4" />
                {payingWithWallet ? "Paying…" : "Pay with wallet balance"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

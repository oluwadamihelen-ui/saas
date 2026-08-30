"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageCircle, CreditCard, PartyPopper } from "lucide-react";
import { MamaLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS_CATEGORIES } from "@/lib/validation/business";
import { cn } from "@/lib/utils";

const STEPS = [
  "WELCOME",
  "BUSINESS_INFO",
  "CATEGORY",
  "FIRST_PRODUCT",
  "WHATSAPP",
  "PAYMENT",
  "COMPLETE",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  const [businessInfo, setBusinessInfo] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    country: "Nigeria",
    currency: "NGN",
  });
  const [category, setCategory] = useState<string>("");
  const [product, setProduct] = useState({
    name: "",
    description: "",
    price: "",
    costPrice: "",
    sku: "",
    stockQuantity: "",
    lowStockThreshold: "10",
  });
  const [whatsapp, setWhatsapp] = useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  const [paystack, setPaystack] = useState({ paystackPublicKey: "", paystackSecretKey: "" });

  const step = STEPS[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));

  async function submitBusiness() {
    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...businessInfo, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create business");
        return;
      }
      setBusinessId(data.business.id);
      setBusinessName(data.business.name);
      next();
    } finally {
      setLoading(false);
    }
  }

  async function submitProduct() {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: product.name,
          description: product.description || undefined,
          price: Number(product.price || 0),
          costPrice: product.costPrice ? Number(product.costPrice) : undefined,
          sku: product.sku || undefined,
          stockQuantity: Number(product.stockQuantity || 0),
          lowStockThreshold: Number(product.lowStockThreshold || 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not add product");
        return;
      }
      toast.success(`${product.name} added to your catalog`);
      next();
    } finally {
      setLoading(false);
    }
  }

  async function submitWhatsapp(skip = false) {
    if (!businessId) return;
    if (skip) {
      next();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not connect WhatsApp");
        return;
      }
      toast.success("WhatsApp connected");
      next();
    } finally {
      setLoading(false);
    }
  }

  async function submitPaystack(skip = false) {
    if (!businessId) return;
    if (skip) {
      next();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...paystack }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not connect Paystack");
        return;
      }
      toast.success("Paystack connected");
      next();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <MamaLogo className="text-base" />
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 w-6 rounded-full",
                  i <= stepIndex ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {step === "WELCOME" && (
            <Card>
              <CardContent className="pt-8 text-center">
                <MamaLogo className="mx-auto text-2xl" />
                <h1 className="mt-6 text-2xl font-bold tracking-tight">
                  Your business. One intelligent platform.
                </h1>
                <p className="mt-3 text-muted-foreground">
                  Sell, manage customers, track orders, control inventory and grow your business
                  from one place.
                </p>
                <Button size="lg" className="mt-8 w-full" onClick={next}>
                  Start my business
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "BUSINESS_INFO" && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold">Tell us about your business</h2>
                <p className="mt-1 text-sm text-muted-foreground">This helps Mama set things up for you.</p>
                <div className="mt-6 space-y-4">
                  <Field label="Business name">
                    <Input
                      value={businessInfo.name}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                      placeholder="Mama Foodstuff"
                    />
                  </Field>
                  <Field label="Owner name">
                    <Input
                      value={businessInfo.ownerName}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, ownerName: e.target.value })}
                      placeholder="Chioma Eze"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone">
                      <Input
                        value={businessInfo.phone}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                        placeholder="+2348012345678"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={businessInfo.email}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                        placeholder="business@email.com"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Country">
                      <Input value={businessInfo.country} disabled />
                    </Field>
                    <Field label="Currency">
                      <Input value={businessInfo.currency} disabled />
                    </Field>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={!businessInfo.name || !businessInfo.ownerName || !businessInfo.phone || !businessInfo.email}
                  onClick={next}
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "CATEGORY" && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold">What does your business sell?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick the closest category.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {BUSINESS_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                        category === c
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <Button size="lg" className="mt-8 w-full" disabled={!category || loading} onClick={submitBusiness}>
                  {loading ? "Setting up your business…" : "Continue"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "FIRST_PRODUCT" && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold">Add your first product</h2>
                <p className="mt-1 text-sm text-muted-foreground">You can add more products anytime.</p>
                <div className="mt-6 space-y-4">
                  <Field label="Product name">
                    <Input
                      value={product.name}
                      onChange={(e) => setProduct({ ...product, name: e.target.value })}
                      placeholder="5kg Rice"
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={product.description}
                      onChange={(e) => setProduct({ ...product, description: e.target.value })}
                      placeholder="Premium long-grain rice, 5kg bag"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Price (₦)">
                      <Input
                        type="number"
                        value={product.price}
                        onChange={(e) => setProduct({ ...product, price: e.target.value })}
                        placeholder="8500"
                      />
                    </Field>
                    <Field label="Cost price (₦)">
                      <Input
                        type="number"
                        value={product.costPrice}
                        onChange={(e) => setProduct({ ...product, costPrice: e.target.value })}
                        placeholder="7200"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Stock quantity">
                      <Input
                        type="number"
                        value={product.stockQuantity}
                        onChange={(e) => setProduct({ ...product, stockQuantity: e.target.value })}
                        placeholder="50"
                      />
                    </Field>
                    <Field label="Low-stock alert below">
                      <Input
                        type="number"
                        value={product.lowStockThreshold}
                        onChange={(e) => setProduct({ ...product, lowStockThreshold: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="SKU (optional)">
                    <Input
                      value={product.sku}
                      onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                      placeholder="RICE-5KG"
                    />
                  </Field>
                </div>
                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={!product.name || !product.price || loading}
                  onClick={submitProduct}
                >
                  {loading ? "Adding product…" : "Continue"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "WHATSAPP" && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">Connect WhatsApp</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect your WhatsApp Business account and let Mama help you manage customer
                  conversations and orders.
                </p>
                <div className="mt-6 space-y-4 text-left">
                  <Field label="Phone Number ID">
                    <Input
                      value={whatsapp.phoneNumberId}
                      onChange={(e) => setWhatsapp({ ...whatsapp, phoneNumberId: e.target.value })}
                      placeholder="From Meta for Developers → WhatsApp → API Setup"
                    />
                  </Field>
                  <Field label="WhatsApp Business Account ID">
                    <Input
                      value={whatsapp.wabaId}
                      onChange={(e) => setWhatsapp({ ...whatsapp, wabaId: e.target.value })}
                    />
                  </Field>
                  <Field label="Access token">
                    <Input
                      type="password"
                      value={whatsapp.accessToken}
                      onChange={(e) => setWhatsapp({ ...whatsapp, accessToken: e.target.value })}
                    />
                  </Field>
                </div>
                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={loading || !whatsapp.phoneNumberId || !whatsapp.wabaId || !whatsapp.accessToken}
                  onClick={() => submitWhatsapp(false)}
                >
                  {loading ? "Connecting…" : "Connect WhatsApp"}
                </Button>
                <button
                  className="mt-3 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => submitWhatsapp(true)}
                >
                  I&apos;ll do this later
                </button>
              </CardContent>
            </Card>
          )}

          {step === "PAYMENT" && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">Connect Paystack</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your Paystack keys so MAMA can accept payments on your behalf.
                </p>
                <div className="mt-6 space-y-4 text-left">
                  <Field label="Paystack public key">
                    <Input
                      value={paystack.paystackPublicKey}
                      onChange={(e) => setPaystack({ ...paystack, paystackPublicKey: e.target.value })}
                      placeholder="pk_test_..."
                    />
                  </Field>
                  <Field label="Paystack secret key">
                    <Input
                      type="password"
                      value={paystack.paystackSecretKey}
                      onChange={(e) => setPaystack({ ...paystack, paystackSecretKey: e.target.value })}
                      placeholder="sk_test_..."
                    />
                  </Field>
                </div>
                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={loading || !paystack.paystackPublicKey || !paystack.paystackSecretKey}
                  onClick={() => submitPaystack(false)}
                >
                  {loading ? "Connecting…" : "Connect Paystack"}
                </Button>
                <button
                  className="mt-3 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => submitPaystack(true)}
                >
                  I&apos;ll do this later
                </button>
              </CardContent>
            </Card>
          )}

          {step === "COMPLETE" && (
            <Card>
              <CardContent className="pt-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PartyPopper className="h-7 w-7" />
                </div>
                <h1 className="mt-6 text-2xl font-bold">🎉 Your business is ready.</h1>
                <p className="mt-2 text-muted-foreground">
                  {businessName || "Your business"} is now live on MAMA.
                </p>
                <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
                  {["Business created", "First product added", "Ready to sell"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {t}
                    </li>
                  ))}
                </ul>
                <Button size="lg" className="mt-8 w-full" onClick={() => router.push("/dashboard")}>
                  Open Mama Business
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

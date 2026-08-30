"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { MamaLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Invalid email or password");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <MamaLogo className="text-2xl" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <h1 className="text-xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Log in to run your business.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@business.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Your password"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Logging in…" : "Log in"}
              </Button>
            </form>
            <Button
              variant="outline"
              size="lg"
              className="mt-3 w-full"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              type="button"
            >
              Continue with Google
            </Button>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to MAMA?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Start my business
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

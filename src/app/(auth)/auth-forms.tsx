"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/components/ui";
import { loginAction, registerAction } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to check your risk.</p>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <Field label="Email"><Input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">New here? <Link href="/register" className="text-accent hover:underline">Create an account</Link></p>
    </Card>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const f = state.fields ?? {};
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Free to start. Set up your risk rules in about a minute.</p>
      <form action={action} className="mt-5 space-y-4">
        <Field label="Name" error={f.name}><Input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Email" error={f.email}><Input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password" error={f.password} hint="At least 8 characters."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
        {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Already have an account? <Link href="/login" className="text-accent hover:underline">Log in</Link></p>
    </Card>
  );
}

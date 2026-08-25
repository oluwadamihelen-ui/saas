"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface UserAdminRowData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  walletBalance: number;
  createdAt: string;
}

export function UserManagementTable({ users }: { users: UserAdminRowData[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input max-w-xs"
        />
        <span className="text-xs text-cinerra-muted">
          {filtered.length} of {users.length} shown (most recent {users.length})
        </span>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-cinerra-muted">No users match that search.</p>
        ) : (
          filtered.map((u) => <UserRow key={u.id} user={u} />)
        )}
      </div>
    </div>
  );
}

function UserRow({ user }: { user: UserAdminRowData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-cinerra-text">{user.name ?? user.email}</p>
          <p className="truncate text-xs text-cinerra-muted">{user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className={user.role === "ADMIN" ? "text-cinerra-accent2" : "text-cinerra-muted"}>{user.role}</span>
          <span className={user.status === "SUSPENDED" ? "rounded-full bg-red-500/20 px-2 py-0.5 text-red-300" : "text-emerald-400"}>
            {user.status}
          </span>
          <span className="text-cinerra-gold">🪙 {user.walletBalance.toLocaleString()}</span>
          <span className="text-cinerra-muted">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-cinerra-border pt-4 lg:grid-cols-3">
          <EditProfileForm user={user} />
          <AdjustBalanceForm userId={user.id} />
          <SuspendToggle email={user.email} status={user.status} />
        </div>
      )}
    </div>
  );
}

function EditProfileForm({ user }: { user: UserAdminRowData }) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save changes.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-cinerra-muted">Edit profile</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input" />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="input" required />
      <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <div className="mt-1 flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-secondary-xs">
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}

function AdjustBalanceForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't adjust balance.");
      setResult(data.balanceAfter);
      setAmount(0);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't adjust balance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-cinerra-muted">Adjust coin balance</p>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Amount (+credit / -debit)"
        className="input"
      />
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={500} className="input" />
      <div className="mt-1 flex items-center gap-3">
        <button type="submit" disabled={saving || amount === 0} className="btn-secondary-xs">
          {saving ? "Applying…" : "Apply"}
        </button>
        {result !== null && <span className="text-xs text-emerald-400">New balance: 🪙 {result.toLocaleString()}</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}

function SuspendToggle({ email, status }: { email: string; status: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = status === "SUSPENDED";

  async function handleClick() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserEmail: email, action: suspended ? "UNSUSPEND" : "SUSPEND" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update account status.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update account status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-cinerra-muted">Account access</p>
      <p className="text-xs text-cinerra-muted">
        {suspended ? "This account is suspended and can't sign in." : "This account can sign in normally."}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={saving}
          className={suspended ? "btn-secondary-xs" : "rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"}
        >
          {saving ? "Working…" : suspended ? "Unsuspend" : "Suspend"}
        </button>
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

export interface UserAdminRowData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  walletBalance: number;
  createdAt: string;
  emailVerified: boolean;
}

interface UsersResponse {
  users: UserAdminRowData[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function UserManagementTable({
  initialUsers,
  initialTotalCount,
  pageSize,
}: {
  initialUsers: UserAdminRowData[];
  initialTotalCount: number;
  pageSize: number;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchUsers(nextPage: number, nextSearch: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (nextSearch) params.set("search", nextSearch);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data: UsersResponse = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalCount(data.totalCount);
        setPage(data.page);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(1, value), 300);
  }

  function refreshCurrentPage() {
    fetchUsers(page, search);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="input max-w-xs py-2 text-sm"
        />
        <span className="shrink-0 text-xs text-cinerra-muted">
          {totalCount === 0 ? "No users" : `${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()}`}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-cinerra-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-cinerra-surface text-xs uppercase text-cinerra-muted">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-cinerra-border">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-cinerra-muted">
                  {loading ? "Loading…" : "No users match that search."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRows
                  key={u.id}
                  user={u}
                  expanded={expandedId === u.id}
                  onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  onChanged={refreshCurrentPage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-cinerra-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => fetchUsers(page - 1, search)} className="btn-secondary-xs">
            Prev
          </button>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => fetchUsers(page + 1, search)} className="btn-secondary-xs">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRows({
  user,
  expanded,
  onToggle,
  onChanged,
}: {
  user: UserAdminRowData;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer transition hover:bg-cinerra-surface2/40">
        <td className="max-w-[220px] px-3 py-2">
          <p className="truncate font-medium text-cinerra-text">{user.name ?? user.email}</p>
          <p className="truncate text-xs text-cinerra-muted">{user.email}</p>
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs ${user.role === "ADMIN" ? "text-cinerra-accent2" : "text-cinerra-muted"}`}>{user.role}</span>
        </td>
        <td className="px-3 py-2">
          <span
            className={
              user.status === "SUSPENDED"
                ? "rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-300"
                : "text-[11px] font-medium text-emerald-400"
            }
          >
            {user.status}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-cinerra-gold">🪙 {user.walletBalance.toLocaleString()}</td>
        <td className="px-3 py-2 text-xs text-cinerra-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
        <td className="px-3 py-2 text-right text-cinerra-muted">{expanded ? "▲" : "▼"}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className="border-t border-cinerra-border bg-cinerra-surface2/30 px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <EditProfileForm user={user} onSaved={onChanged} />
              <AdjustBalanceForm userId={user.id} onApplied={onChanged} />
              <SuspendToggle email={user.email} status={user.status} onChanged={onChanged} />
              <EmailVerificationAction userId={user.id} emailVerified={user.emailVerified} onChanged={onChanged} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EditProfileForm({ user, onSaved }: { user: UserAdminRowData; onSaved: () => void }) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
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
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cinerra-muted">Edit profile</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input px-2.5 py-1.5 text-xs" />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="input px-2.5 py-1.5 text-xs"
        required
      />
      <select value={role} onChange={(e) => setRole(e.target.value)} className="input px-2.5 py-1.5 text-xs">
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

function AdjustBalanceForm({ userId, onApplied }: { userId: string; onApplied: () => void }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
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
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't adjust balance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cinerra-muted">Adjust Doe balance</p>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Amount (+credit / -debit)"
        className="input px-2.5 py-1.5 text-xs"
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        maxLength={500}
        className="input px-2.5 py-1.5 text-xs"
      />
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

function EmailVerificationAction({ userId, emailVerified, onChanged }: { userId: string; emailVerified: boolean; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't verify this email.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify this email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cinerra-muted">Email verification</p>
      <p className="text-xs text-cinerra-muted">
        {emailVerified ? "Verified — can generate and publish." : "Unverified — blocked from generation and publishing."}
      </p>
      {!emailVerified && (
        <div className="mt-1 flex items-center gap-3">
          <button type="button" onClick={handleClick} disabled={saving} className="btn-secondary-xs">
            {saving ? "Verifying…" : "Mark verified"}
          </button>
          {error && <span className="text-xs text-red-300">{error}</span>}
        </div>
      )}
    </div>
  );
}

function SuspendToggle({ email, status, onChanged }: { email: string; status: string; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = status === "SUSPENDED";

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
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
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update account status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cinerra-muted">Account access</p>
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

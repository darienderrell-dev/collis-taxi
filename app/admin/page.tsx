"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { fmtMoney, fmtDateTime } from "@/lib/fmt";

export default function AdminPage() {
  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-3xl w-full pt-8">
        <AuthLoading>
          <div className="text-sm text-slate-500">Loading…</div>
        </AuthLoading>
        <Unauthenticated>
          <div className="text-sm text-slate-400">
            Admin sign-in required.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            with phone "ADMIN".
          </div>
        </Unauthenticated>
        <Authenticated>
          <AdminGate />
        </Authenticated>
      </div>
    </main>
  );
}

function AdminGate() {
  const me = useQuery(api.users.currentUser);
  if (me === undefined) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!me) return null;
  if (me.role !== "admin") {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5">
        <div className="text-sm font-medium text-rose-200">Not authorized</div>
        <div className="text-xs text-slate-400 mt-1">
          You're signed in as {me.role ?? "client"}. To use admin, sign in with
          phone "ADMIN".
        </div>
        <Link
          href="/"
          className="mt-4 inline-block text-amber-400 underline text-xs"
        >
          Back home
        </Link>
      </div>
    );
  }
  return <AdminDashboard me={me} />;
}

function AdminDashboard({ me }: { me: Doc<"users"> }) {
  const [tab, setTab] = useState<"pricing" | "bookings" | "clients">("pricing");
  const { signOut } = useAuthActions();
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400">Signed in as</div>
          <div className="text-lg font-semibold">{me.name ?? "Admin"}</div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/driver" className="text-amber-400 underline">
            Driver view
          </Link>
          <button onClick={() => signOut()} className="text-slate-400 underline">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-6">
        {(["pricing", "bookings", "clients"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 py-2 rounded-lg text-sm capitalize " +
              (tab === t ? "bg-slate-700 text-white" : "text-slate-400")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "pricing" && <PricingPanel />}
      {tab === "bookings" && <BookingsPanel />}
      {tab === "clients" && <ClientsPanel />}
    </>
  );
}

// ============================================================
// Pricing — zones + matrix editor
// ============================================================
function PricingPanel() {
  const data = useQuery(api.zones.matrix);
  const createZone = useMutation(api.zones.createZone);
  const removeZone = useMutation(api.zones.removeZone);
  const setPrice = useMutation(api.zones.setPrice);
  const [newZone, setNewZone] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    if (!newZone.trim()) return;
    try {
      await createZone({ name: newZone.trim() });
      setNewZone("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }
  async function remove(id: Id<"zones">, name: string) {
    if (!confirm(`Remove "${name}" and all its prices?`)) return;
    await removeZone({ id });
  }

  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;
  const { zones, prices } = data;

  // Key the matrix consistently with the mutation
  const keyOf = (a: Id<"zones">, b: Id<"zones">) =>
    (a as unknown as string) < (b as unknown as string)
      ? `${a}|${b}`
      : `${b}|${a}`;

  return (
    <>
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-sm font-medium mb-1">Zones</div>
        <div className="text-xs text-slate-400 mb-3">
          Add or remove the locations clients can pick.
        </div>
        <div className="flex gap-2">
          <input
            value={newZone}
            onChange={(e) => setNewZone(e.target.value)}
            placeholder="New zone name"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            onClick={add}
            className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
          >
            Add
          </button>
        </div>
        {err && <div className="text-xs text-rose-400 mt-2">{err}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <span
              key={z._id}
              className="inline-flex items-center gap-1 bg-slate-800 rounded-full pl-2 pr-1 py-0.5 text-xs"
            >
              {z.name}
              <button
                onClick={() => remove(z._id, z.name)}
                className="text-rose-400 px-1"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-sm font-medium mb-1">Price matrix (G$)</div>
        <div className="text-xs text-slate-400 mb-3">
          Edit any cell. Same-zone prices are italic; the matrix is symmetric so
          you only need to fill the upper-right half — the rest mirrors.
        </div>
        <div className="overflow-auto">
          <table className="text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-900 text-left p-1"></th>
                {zones.map((z) => (
                  <th
                    key={z._id}
                    className="p-1 text-slate-400 font-normal whitespace-nowrap"
                    title={z.name}
                  >
                    {z.name.length > 10 ? z.name.slice(0, 10) + "…" : z.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((a, i) => (
                <tr key={a._id}>
                  <td
                    className="sticky left-0 bg-slate-900 p-1 text-slate-300 whitespace-nowrap pr-2"
                    title={a.name}
                  >
                    {a.name.length > 14 ? a.name.slice(0, 14) + "…" : a.name}
                  </td>
                  {zones.map((b, j) => {
                    if (j < i)
                      return (
                        <td key={b._id} className="p-1">
                          <div className="w-16 text-center text-slate-600">·</div>
                        </td>
                      );
                    const k = keyOf(a._id, b._id);
                    const value = prices[k] ?? "";
                    return (
                      <td key={b._id} className="p-1">
                        <PriceCell
                          value={value}
                          sameZone={a._id === b._id}
                          onChange={(v) =>
                            setPrice({ zoneAId: a._id, zoneBId: b._id, price: v })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PriceCell({
  value,
  sameZone,
  onChange,
}: {
  value: number | "";
  sameZone: boolean;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState<string>(String(value));
  // Sync if external value changes (e.g. another admin in another tab edits)
  if (String(value) !== local && document.activeElement?.tagName !== "INPUT") {
    setLocal(String(value));
  }
  return (
    <input
      type="number"
      min={0}
      step={50}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local);
        if (!Number.isFinite(n)) {
          setLocal(String(value));
          return;
        }
        if (n !== value) onChange(Math.max(0, Math.round(n)));
      }}
      className={
        "w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-right text-xs " +
        (sameZone ? "italic text-slate-400" : "")
      }
    />
  );
}

// ============================================================
// All bookings
// ============================================================
function BookingsPanel() {
  const rows = useQuery(api.bookings.listAll);
  if (!rows) return <div className="text-sm text-slate-500">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4">
        No bookings yet.
      </div>
    );
  return (
    <div className="space-y-2">
      {rows.map((b) => (
        <div
          key={b._id}
          className="p-3 rounded-xl bg-slate-900 border border-slate-800"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {b.pickupZone} → {b.dropoffZone}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-amber-300">
              {b.status.replace(/_/g, " ")}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <div className="text-slate-500">
              {b.scheduledFor
                ? "For " + fmtDateTime(b.scheduledFor)
                : "ASAP — " + fmtDateTime(b._creationTime)}
            </div>
            <div className="text-slate-200">{fmtMoney(b.price)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Clients
// ============================================================
function ClientsPanel() {
  // Reuse listAll; we'd add a users-list query later if needed.
  // For now, derive distinct clients from bookings as a v1 approach.
  const rows = useQuery(api.bookings.listAll);
  if (!rows) return <div className="text-sm text-slate-500">Loading…</div>;
  return (
    <div className="text-sm text-slate-400">
      v1 admin shows clients via bookings. A dedicated users listing query lands
      in v1.1 — for now the bookings list above identifies who's active.
    </div>
  );
}

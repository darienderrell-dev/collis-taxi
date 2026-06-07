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
    <main className="min-h-dvh flex items-start justify-center p-4 pb-safe-with-install">
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
// Pricing — Simple route list with tap-to-edit. Designed for older users:
// big touch targets, single-route focus, +/- buttons, big SAVE.
// ============================================================
function PricingPanel() {
  const data = useQuery(api.zones.matrix);
  const createZone = useMutation(api.zones.createZone);
  const removeZone = useMutation(api.zones.removeZone);
  const setPrice = useMutation(api.zones.setPrice);
  const [newZone, setNewZone] = useState("");
  const [zoneErr, setZoneErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{
    aId: Id<"zones">;
    bId: Id<"zones">;
    aName: string;
    bName: string;
    current: number;
  } | null>(null);

  async function add() {
    setZoneErr(null);
    if (!newZone.trim()) return;
    try {
      await createZone({ name: newZone.trim() });
      setNewZone("");
    } catch (e: unknown) {
      setZoneErr(e instanceof Error ? e.message : "Failed");
    }
  }
  async function remove(id: Id<"zones">, name: string) {
    if (!confirm(`Remove "${name}" and all its prices?`)) return;
    await removeZone({ id });
  }

  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;
  const { zones, prices } = data;

  // Symmetric pair key — match the mutation.
  const keyOf = (a: Id<"zones">, b: Id<"zones">) =>
    (a as unknown as string) < (b as unknown as string)
      ? `${a}|${b}`
      : `${b}|${a}`;

  // Flat list of every pair (one direction only). Sorted alphabetically.
  const pairs: { aId: Id<"zones">; bId: Id<"zones">; aName: string; bName: string; price: number; sameZone: boolean }[] = [];
  const sortedZones = [...zones].sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < sortedZones.length; i++) {
    for (let j = i; j < sortedZones.length; j++) {
      const a = sortedZones[i];
      const b = sortedZones[j];
      pairs.push({
        aId: a._id,
        bId: b._id,
        aName: a.name,
        bName: b.name,
        price: prices[keyOf(a._id, b._id)] ?? 0,
        sameZone: a._id === b._id,
      });
    }
  }
  const q = search.trim().toLowerCase();
  const filtered = q
    ? pairs.filter(
        (p) =>
          p.aName.toLowerCase().includes(q) ||
          p.bName.toLowerCase().includes(q),
      )
    : pairs;

  return (
    <>
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-base font-semibold mb-1">Places we go</div>
        <div className="text-xs text-slate-400 mb-3">
          Add a new place or remove one you don&apos;t serve.
        </div>
        <div className="flex gap-2">
          <input
            value={newZone}
            onChange={(e) => setNewZone(e.target.value)}
            placeholder="e.g. Airport"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-amber-500"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            onClick={add}
            className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 text-base font-semibold"
          >
            Add
          </button>
        </div>
        {zoneErr && <div className="text-xs text-rose-400 mt-2">{zoneErr}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sortedZones.map((z) => (
            <span
              key={z._id}
              className="inline-flex items-center gap-1 bg-slate-800 rounded-full pl-3 pr-1 py-1 text-sm"
            >
              {z.name}
              <button
                onClick={() => remove(z._id, z.name)}
                className="text-rose-400 w-6 h-6 rounded-full hover:bg-slate-700 text-lg leading-none"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-base font-semibold mb-1">Prices</div>
        <div className="text-xs text-slate-400 mb-3">
          Tap any trip to change its price.
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Find a place (e.g. Mackenzie)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:border-amber-500"
        />
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-6">
              No trips match &ldquo;{search}&rdquo;.
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={`${p.aId}-${p.bId}`}
              onClick={() =>
                setEditing({
                  aId: p.aId,
                  bId: p.bId,
                  aName: p.aName,
                  bName: p.bName,
                  current: p.price,
                })
              }
              className="w-full text-left p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                {p.sameZone ? (
                  <>
                    <div className="text-base font-medium truncate">{p.aName}</div>
                    <div className="text-xs text-slate-500">within the same area</div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-medium truncate">
                      {p.aName}
                    </div>
                    <div className="text-xs text-slate-500">to {p.bName}</div>
                  </>
                )}
              </div>
              <div className="text-xl font-bold text-amber-300 whitespace-nowrap">
                {fmtMoney(p.price)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {editing && (
        <PriceEditor
          {...editing}
          onSave={(price) =>
            setPrice({ zoneAId: editing.aId, zoneBId: editing.bId, price })
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PriceEditor({
  aName,
  bName,
  current,
  onSave,
  onClose,
}: {
  aId: Id<"zones">;
  bId: Id<"zones">;
  aName: string;
  bName: string;
  current: number;
  onSave: (price: number) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState<number>(current);
  const sameZone = aName === bName;

  function bump(delta: number) {
    setVal((v) => Math.max(0, v + delta));
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-wider text-slate-400">
          From
        </div>
        <div className="text-xl font-semibold">{aName}</div>
        {!sameZone && (
          <>
            <div className="text-xs uppercase tracking-wider text-slate-400 mt-3">
              To
            </div>
            <div className="text-xl font-semibold">{bName}</div>
          </>
        )}
        {sameZone && (
          <div className="text-xs text-slate-500 mt-1">
            Trips within the same area
          </div>
        )}

        <div className="text-xs uppercase tracking-wider text-slate-400 mt-6 mb-2">
          Price
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => bump(-100)}
            className="w-14 h-14 rounded-full bg-slate-800 text-3xl font-bold text-slate-200 active:bg-slate-700"
          >
            −
          </button>
          <div className="flex-1 flex items-baseline justify-center gap-1 bg-slate-800 rounded-2xl py-4">
            <span className="text-slate-400 text-xl">G$</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={50}
              value={val}
              onChange={(e) =>
                setVal(Math.max(0, Number(e.target.value) || 0))
              }
              className="bg-transparent text-4xl font-bold text-center w-32 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => bump(100)}
            className="w-14 h-14 rounded-full bg-slate-800 text-3xl font-bold text-slate-200 active:bg-slate-700"
          >
            +
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-2 text-xs text-slate-500">
          <button onClick={() => bump(-500)} className="px-2 py-1">
            −500
          </button>
          <button onClick={() => bump(500)} className="px-2 py-1">
            +500
          </button>
        </div>

        <button
          onClick={() => {
            onSave(val);
            onClose();
          }}
          className="mt-6 w-full py-4 rounded-2xl bg-amber-500 text-slate-950 font-bold text-lg"
        >
          Save — {fmtMoney(val)}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full py-3 text-slate-400 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
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

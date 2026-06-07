"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  // Reports lands first because that's the daily-ops view Gale opens to
  // see "how's the business doing today" — pricing changes are rarer.
  const [tab, setTab] = useState<"reports" | "pricing" | "bookings" | "clients">(
    "reports",
  );
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
        {(["reports", "pricing", "bookings", "clients"] as const).map((t) => (
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

      {tab === "reports" && <ReportsPanel />}
      {tab === "pricing" && <PricingPanel />}
      {tab === "bookings" && <BookingsPanel />}
      {tab === "clients" && <ClientsPanel />}
    </>
  );
}

// ============================================================
// Reports — Today / This week / This month tiles + filterable trip list.
// Built for Gale: tiles up top so she can answer "how's today going" in a
// glance; trip list below with passenger names so she can match calls and
// chase no-shows.
// ============================================================
function ReportsPanel() {
  // Window selector for the trip list at the bottom. The three tiles up
  // top always show today/week/month no matter what — they're the "at a
  // glance" numbers and shouldn't move when she filters the list.
  const [window, setWindow] = useState<"today" | "week" | "month">("today");

  // Memoise so the queries don't refetch on every render.
  const ranges = useMemo(() => buildRanges(), []);

  const today = useQuery(api.bookings.summaryForRange, ranges.today);
  const week = useQuery(api.bookings.summaryForRange, ranges.week);
  const month = useQuery(api.bookings.summaryForRange, ranges.month);

  const listRange =
    window === "today" ? ranges.today : window === "week" ? ranges.week : ranges.month;
  const trips = useQuery(api.bookings.listForRange, listRange);

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile label="Today" data={today} accent="amber" />
        <SummaryTile label="This week" data={week} accent="emerald" />
        <SummaryTile label="This month" data={month} accent="sky" />
      </section>

      <section className="mt-6 rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold">Trips</div>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 text-xs">
            {(["today", "week", "month"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={
                  "px-3 py-1 rounded-md capitalize " +
                  (window === w ? "bg-slate-600 text-white" : "text-slate-400")
                }
              >
                {w === "week" ? "This week" : w === "month" ? "This month" : "Today"}
              </button>
            ))}
          </div>
        </div>

        {trips === undefined && (
          <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
        )}
        {trips && trips.length === 0 && (
          <div className="text-sm text-slate-500 py-6 text-center">
            No trips in this window.
          </div>
        )}
        {trips && trips.length > 0 && (
          <div className="space-y-2">
            {trips.map((b) => (
              <TripRow key={b._id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryTile({
  label,
  data,
  accent,
}: {
  label: string;
  data:
    | {
        count: number;
        revenue: number;
        completed: number;
        cancelled: number;
        pending: number;
      }
    | undefined;
  accent: "amber" | "emerald" | "sky";
}) {
  const accentMap = {
    amber: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-200",
    emerald:
      "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-200",
    sky: "from-sky-500/15 to-sky-500/0 border-sky-500/30 text-sky-200",
  };
  return (
    <div
      className={
        "rounded-2xl bg-gradient-to-br border p-4 " + accentMap[accent]
      }
    >
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      {data === undefined ? (
        <div className="text-sm text-slate-400 mt-2">Loading…</div>
      ) : (
        <>
          <div className="mt-1 text-3xl font-bold text-white">
            {fmtMoney(data.revenue)}
          </div>
          <div className="text-xs text-slate-300/80 mt-1">
            {data.completed} completed
            {data.pending > 0 && ` · ${data.pending} in progress`}
            {data.cancelled > 0 && ` · ${data.cancelled} cancelled/no-show`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {data.count} total trip{data.count === 1 ? "" : "s"}
          </div>
        </>
      )}
    </div>
  );
}

function TripRow({
  booking,
}: {
  booking: Doc<"bookings"> & { clientName?: string; clientPhone?: string };
}) {
  const t = booking.scheduledFor ?? booking._creationTime;
  const isCompleted = booking.status === "completed";
  const isLost = ["cancelled", "declined", "no_show"].includes(booking.status);
  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium truncate">
          {booking.pickupZone} → {booking.dropoffZone}
        </div>
        <div
          className={
            "text-[11px] uppercase tracking-wider whitespace-nowrap " +
            (isCompleted
              ? "text-emerald-300"
              : isLost
              ? "text-rose-300"
              : "text-amber-300")
          }
        >
          {booking.status.replace(/_/g, " ")}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <div className="text-slate-400 truncate">
          <span aria-hidden>👤</span>{" "}
          {booking.clientName ?? "Passenger"}
          {booking.clientPhone && (
            <span className="text-slate-500"> · {booking.clientPhone}</span>
          )}
        </div>
        <div
          className={
            "whitespace-nowrap ml-2 " +
            (isCompleted ? "text-emerald-200 font-semibold" : "text-slate-300")
          }
        >
          {fmtMoney(booking.price)}
        </div>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">
        {booking.scheduledFor ? "Scheduled · " : ""}
        {fmtDateTime(t)}
      </div>
    </div>
  );
}

/**
 * Compute start/end timestamps (ms) for "today", "this week" (Mon-start),
 * and "this month" (1st of month). All anchored to user local time.
 */
function buildRanges() {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  // ISO week: Monday is the first day. JS getDay() returns 0=Sun..6=Sat.
  const dow = now.getDay();
  const daysSinceMon = (dow + 6) % 7;
  const startOfWeek = startOfDay - daysSinceMon * 86400000;
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).getTime();
  // End at "now + 1 day" so scheduled-for-later-today rows still show up.
  const endMs = startOfDay + 86400000;
  return {
    today: { startMs: startOfDay, endMs },
    week: { startMs: startOfWeek, endMs },
    month: { startMs: startOfMonth, endMs },
  };
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
// All bookings — full history (Reports is the daily view)
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
        <TripRow key={b._id} booking={b} />
      ))}
    </div>
  );
}

// ============================================================
// Clients — Everyone who's ever booked, with trip counts and spend.
// Sorted by frequency so Gale can see her regulars at a glance, with
// search to find a specific name/number quickly.
// ============================================================
function ClientsPanel() {
  const rows = useQuery(api.bookings.clientsSummary);
  const [search, setSearch] = useState("");

  if (rows === undefined)
    return <div className="text-sm text-slate-500">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4">
        No clients yet — they show up here after their first booking.
      </div>
    );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          (r.name ?? "").toLowerCase().includes(q) ||
          (r.phone ?? "").toLowerCase().includes(q),
      )
    : rows;

  // "Regulars" = at least 5 trips. Shown as a badge.
  const regularThreshold = 5;
  // Lifetime totals across all clients shown.
  const totalRevenue = rows.reduce((s, r) => s + r.totalSpent, 0);
  const totalTrips = rows.reduce((s, r) => s + r.completedTrips, 0);

  return (
    <>
      <section className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <div className="text-xs text-slate-400">Clients</div>
          <div className="text-2xl font-bold mt-1">{rows.length}</div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <div className="text-xs text-slate-400">Lifetime trips</div>
          <div className="text-2xl font-bold mt-1">{totalTrips}</div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <div className="text-xs text-slate-400">Lifetime revenue</div>
          <div className="text-2xl font-bold mt-1 text-amber-300">
            {fmtMoney(totalRevenue)}
          </div>
        </div>
      </section>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Find a client (name or phone)"
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:border-amber-500"
      />

      {filtered.length === 0 && (
        <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          No clients match &ldquo;{search}&rdquo;.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((r) => {
          const safe = r.phone?.replace(/[^\d+]/g, "") ?? "";
          const isRegular = r.totalTrips >= regularThreshold;
          return (
            <div
              key={r.userId}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold truncate">
                      {r.name ?? "Unnamed client"}
                    </div>
                    {isRegular && (
                      <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-full px-1.5 py-0.5">
                        ⭐ Regular
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {r.phone ?? "No phone on file"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-amber-300">
                    {fmtMoney(r.totalSpent)}
                  </div>
                  <div className="text-[11px] text-slate-500">lifetime</div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="text-slate-300">
                  <span className="font-semibold">{r.totalTrips}</span> trips
                  <span className="text-slate-500">
                    {" "}· {r.completedTrips} done
                    {r.cancelledTrips > 0 && `, ${r.cancelledTrips} cancelled`}
                  </span>
                </div>
                <div className="text-slate-500">
                  Last: {fmtDateTime(r.lastTripAt)}
                </div>
              </div>

              {safe && (
                <div className="mt-2 flex gap-2">
                  <a
                    href={"tel:" + safe}
                    className="flex-1 text-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-sm font-semibold rounded-lg py-2"
                  >
                    📞 Call
                  </a>
                  <a
                    href={"sms:" + safe}
                    className="flex-1 text-center bg-sky-500/15 border border-sky-500/30 text-sky-200 text-sm font-semibold rounded-lg py-2"
                  >
                    💬 Text
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

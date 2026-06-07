"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import * as Sentry from "@sentry/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ZonePicker } from "@/components/ZonePicker";
import { fmtMoney, fmtClock } from "@/lib/fmt";

const QUEUE_CAP = 5;

export default function BookPage() {
  return (
    <main className="min-h-dvh flex items-start justify-center p-6 pb-safe-with-install">
      <div className="max-w-md w-full pt-8">
        <AuthLoading>
          <div className="text-sm text-slate-500">Loading…</div>
        </AuthLoading>
        <Unauthenticated>
          <div className="text-sm text-slate-400">
            You need to <Link href="/login" className="underline">sign in</Link> first.
          </div>
        </Unauthenticated>
        <Authenticated>
          <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
            <BookingForm />
          </Suspense>
        </Authenticated>
      </div>
    </main>
  );
}

function BookingForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Pre-fill from book-again query string (?pickup=...&dropoff=...&notes=...).
  // Zones are resolved by name once the zones list loads.
  const [pickupId, setPickupId] = useState<Id<"zones"> | null>(null);
  const [pickupName, setPickupName] = useState(params.get("pickup") ?? "");
  const [pickupDetail, setPickupDetail] = useState(
    params.get("pickupDetail") ?? "",
  );
  const [dropoffId, setDropoffId] = useState<Id<"zones"> | null>(null);
  const [dropoffName, setDropoffName] = useState(params.get("dropoff") ?? "");
  const [dropoffDetail, setDropoffDetail] = useState(
    params.get("dropoffDetail") ?? "",
  );
  const [when, setWhen] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState(params.get("notes") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live data
  const me = useQuery(api.users.currentUser);
  const zones = useQuery(api.zones.list);
  const driverConfig = useQuery(api.driverConfig.get);
  const queueDepth = useQuery(api.bookings.queueDepth) ?? 0;
  const activeTrip = useQuery(api.bookings.myActiveBooking); // checks if I already have an active booking
  const price = useQuery(
    api.zones.priceBetween,
    pickupId && dropoffId
      ? { zoneAId: pickupId, zoneBId: dropoffId }
      : "skip",
  );

  // Resolve pre-filled zone NAMES to zone IDs once zones load. We do this
  // imperatively in render — safe because setState on same value is a no-op.
  if (zones && pickupName && !pickupId) {
    const z = zones.find((z) => z.name === pickupName);
    if (z) setPickupId(z._id);
  }
  if (zones && dropoffName && !dropoffId) {
    const z = zones.find((z) => z.name === dropoffName);
    if (z) setDropoffId(z._id);
  }

  const favorites = me?.favorites ?? [];

  const createBooking = useMutation(api.bookings.create);

  // Block double-bookings on the client side
  if (activeTrip) {
    return (
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5">
        <div className="text-sm font-medium text-amber-200">
          You already have a booking in progress
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {activeTrip.pickupZone} → {activeTrip.dropoffZone} • {activeTrip.status.replace(/_/g, " ")}
        </div>
        <Link
          href={`/trips/${activeTrip._id}`}
          className="mt-4 block w-full text-center py-3 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm"
        >
          View it
        </Link>
      </div>
    );
  }

  const driverBusy = driverConfig?.availability === "on_job";
  const driverOff = driverConfig?.availability === "off";
  const queueFull = queueDepth >= QUEUE_CAP;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!pickupId || !dropoffId) {
      setErr("Please pick a pickup and dropoff zone");
      return;
    }
    if (price == null) {
      setErr("No price configured for this route — ask the operator.");
      return;
    }
    if (when === "scheduled" && !scheduledAt) {
      setErr("Pick a time, or change to 'right now'.");
      return;
    }
    // If ASAP and driver is busy, force scheduling once the queue is full
    if (when === "now" && driverBusy && queueFull) {
      setErr(`Queue is full (${QUEUE_CAP} people). Please schedule for later.`);
      return;
    }
    setSubmitting(true);
    try {
      const newId = await createBooking({
        pickupZone: pickupName,
        pickupDetail: pickupDetail || undefined,
        dropoffZone: dropoffName,
        dropoffDetail: dropoffDetail || undefined,
        scheduledFor:
          when === "scheduled" ? new Date(scheduledAt).getTime() : undefined,
        notes: notes || undefined,
        price,
      });
      router.push(`/trips/${newId}`);
    } catch (e: unknown) {
      // Report to Sentry so we hear about production bugs.
      // The message still surfaces to the user via setErr below.
      Sentry.captureException(e, {
        tags: { feature: "booking.create" },
        extra: { pickupName, dropoffName, when, scheduledAt },
      });
      setErr(e instanceof Error ? e.message : "Booking failed");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link href="/" className="text-slate-400 text-sm">← Back</Link>
      <div className="text-2xl font-semibold mt-4 mb-1">Where to?</div>
      <div className="text-sm text-slate-400 mb-5">
        Standard prices — confirmed instantly.
      </div>

      {driverOff && (
        <div className="mb-3 rounded-2xl bg-slate-900 border border-slate-800 p-3 text-xs text-slate-400">
          {driverConfig?.driverName ?? "Driver"} is off today — you can still
          schedule for later.
        </div>
      )}
      {driverBusy && !driverOff && (
        <div className="mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
          {driverConfig?.driverName ?? "Driver"} is on a trip right now.
          {when === "now" ? (
            <>
              {" "}
              Booking now joins the queue ({queueDepth}/{QUEUE_CAP} taken
              {queueFull ? " — full!" : ""}).
            </>
          ) : null}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {favorites.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
              Quick pick (favorites)
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <FavChip
                  key={f.id}
                  label={f.label}
                  zoneName={f.zoneName}
                  detail={f.detail}
                  zones={zones ?? []}
                  onApplyPickup={(id, name, det) => {
                    setPickupId(id);
                    setPickupName(name);
                    if (det !== undefined) setPickupDetail(det);
                  }}
                  onApplyDropoff={(id, name, det) => {
                    setDropoffId(id);
                    setDropoffName(name);
                    if (det !== undefined) setDropoffDetail(det);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <ZonePicker
          label="Pickup area"
          icon="🟢"
          zoneId={pickupId}
          zoneName={pickupName}
          onTextChange={(t) => {
            setPickupName(t);
            setPickupId(null);
          }}
          onPick={({ id, name }) => {
            setPickupId(id);
            setPickupName(name);
          }}
          detailLabel="Specific pickup spot (optional)"
          detailPlaceholder="e.g. House #45, blue gate"
          detail={pickupDetail}
          onDetailChange={setPickupDetail}
        />
        <ZonePicker
          label="Dropoff area"
          icon="📍"
          zoneId={dropoffId}
          zoneName={dropoffName}
          onTextChange={(t) => {
            setDropoffName(t);
            setDropoffId(null);
          }}
          onPick={({ id, name }) => {
            setDropoffId(id);
            setDropoffName(name);
          }}
          detailLabel="Specific dropoff spot (optional)"
          detailPlaceholder="e.g. ATM corner by the supermarket"
          detail={dropoffDetail}
          onDetailChange={setDropoffDetail}
        />

        {pickupId && dropoffId && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/30 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300">
                Fare
              </div>
              <div className="text-2xl font-semibold text-amber-200">
                {price === undefined
                  ? "…"
                  : price === null
                  ? "Not set"
                  : fmtMoney(price)}
              </div>
            </div>
            <div className="text-xs text-slate-400 text-right">
              Cash on
              <br />
              pickup
            </div>
          </div>
        )}

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
            When
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWhen("now")}
              className={
                "flex-1 py-2 rounded-xl text-sm border " +
                (when === "now"
                  ? "bg-amber-500 border-amber-500 text-slate-950 font-semibold"
                  : "bg-slate-900 border-slate-700 text-slate-300")
              }
            >
              Right now
            </button>
            <button
              type="button"
              onClick={() => setWhen("scheduled")}
              className={
                "flex-1 py-2 rounded-xl text-sm border " +
                (when === "scheduled"
                  ? "bg-amber-500 border-amber-500 text-slate-950 font-semibold"
                  : "bg-slate-900 border-slate-700 text-slate-300")
              }
            >
              Schedule
            </button>
          </div>
          {when === "scheduled" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              onBlur={(e) => {
                // Snap to the nearest configured slot boundary so the
                // pickup time lines up with how Collis batches his day.
                // Server enforces the same after submit.
                const slot = driverConfig?.slotMinutes ?? 30;
                const snapped = snapToSlot(e.target.value, slot);
                if (snapped && snapped !== e.target.value) {
                  setScheduledAt(snapped);
                }
              }}
              className="mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          )}
          {when === "scheduled" && scheduledAt && (
            <div className="text-xs text-slate-400 mt-1">
              Pickup at {fmtClock(new Date(scheduledAt).getTime())}
              {driverConfig?.slotMinutes && (
                <span className="text-slate-500">
                  {" "}· rounded to {driverConfig.slotMinutes}-min slots
                </span>
              )}
            </div>
          )}
        </div>

        <label className="block">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
            Notes for {driverConfig?.driverName ?? "driver"} (optional)
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 2 passengers, going to the airport"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </label>

        {err && (
          <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full py-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-semibold text-base disabled:opacity-50"
        >
          {submitting
            ? "Sending request…"
            : when === "scheduled"
            ? "Reserve slot"
            : "Request ride"}
        </button>
        <div className="text-[11px] text-slate-500 text-center">
          Payment is cash on pickup.
        </div>
      </form>
    </>
  );
}

/**
 * Snap a "YYYY-MM-DDTHH:MM" datetime-local value to the nearest slot
 * boundary. Returns "" if the input is empty/invalid.
 *
 * Examples (slot=30): "14:07" → "14:00", "14:23" → "14:30".
 */
function snapToSlot(value: string, slotMinutes: number): string {
  if (!value || slotMinutes <= 0) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.round(totalMin / slotMinutes) * slotMinutes;
  d.setHours(0, 0, 0, 0);
  d.setMinutes(snapped);
  // Re-format as datetime-local string (yyyy-MM-ddTHH:mm) in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function FavChip({
  label,
  zoneName,
  detail,
  zones,
  onApplyPickup,
  onApplyDropoff,
}: {
  label: string;
  zoneName: string;
  detail?: string;
  zones: { _id: Id<"zones">; name: string }[];
  onApplyPickup: (id: Id<"zones">, name: string, detail?: string) => void;
  onApplyDropoff: (id: Id<"zones">, name: string, detail?: string) => void;
}) {
  const z = zones.find((z) => z.name === zoneName);
  if (!z) return null; // favorite's zone got deleted from admin
  return (
    <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-full pl-2 pr-1 py-0.5 text-xs">
      <span>⭐ {label}</span>
      <button
        type="button"
        onClick={() => onApplyPickup(z._id, z.name, detail)}
        className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300"
        title="Set as pickup"
      >
        🟢
      </button>
      <button
        type="button"
        onClick={() => onApplyDropoff(z._id, z.name, detail)}
        className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300"
        title="Set as dropoff"
      >
        📍
      </button>
    </div>
  );
}

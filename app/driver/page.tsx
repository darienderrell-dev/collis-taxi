"use client";

import Link from "next/link";
import {
  useMutation,
  useQuery,
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { fmtMoney, fmtDateTime, relTime, countdownLabel } from "@/lib/fmt";

export default function DriverPage() {
  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-md w-full pt-8">
        <AuthLoading>
          <div className="text-sm text-slate-500">Loading…</div>
        </AuthLoading>
        <Unauthenticated>
          <div className="text-sm text-slate-400">
            Driver/admin sign-in required.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            with phone "DRIVER" or "ADMIN".
          </div>
        </Unauthenticated>
        <Authenticated>
          <DriverDashboard />
        </Authenticated>
      </div>
    </main>
  );
}

function DriverDashboard() {
  const me = useQuery(api.users.currentUser);
  const requests = useQuery(api.bookings.incomingRequests);
  const active = useQuery(api.bookings.activeTrip);
  const upNext = useQuery(api.bookings.upNext);
  const config = useQuery(api.driverConfig.get);
  const accept = useMutation(api.bookings.driverAccept);
  const decline = useMutation(api.bookings.driverDecline);
  const transition = useMutation(api.bookings.driverTransition);
  const updateConfig = useMutation(api.driverConfig.update);
  const { signOut } = useAuthActions();

  if (me === undefined) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!me) return null;
  if (me.role !== "driver" && me.role !== "admin") {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5">
        <div className="text-sm font-medium text-rose-200">Not authorized</div>
        <div className="text-xs text-slate-400 mt-1">
          You're signed in as a client. To use the driver dashboard, sign in
          with phone "DRIVER".
        </div>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline text-xs">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400">Signed in as</div>
          <div className="text-lg font-semibold">{me.name}</div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/driver/settings" className="text-amber-400 underline">
            Settings
          </Link>
          {me.role === "admin" && (
            <Link href="/admin" className="text-amber-400 underline">
              Admin
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="text-slate-400 underline"
          >
            Sign out
          </button>
        </div>
      </div>

      <AvailabilityToggle
        config={config ?? null}
        active={active ?? null}
        onChange={(availability) => updateConfig({ availability })}
      />

      {active && (
        <ActiveTripCard
          booking={active}
          onAdvance={(to) => transition({ id: active._id, to })}
        />
      )}

      {upNext && upNext.length > 0 && (
        <UpNextCard
          queue={upNext}
          hasActive={!!active}
          onStart={(id) => transition({ id, to: "on_the_way" })}
        />
      )}

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
          Incoming requests{requests ? ` (${requests.length})` : ""}
        </div>
        {requests === undefined && (
          <div className="text-sm text-slate-500">Loading…</div>
        )}
        {requests && requests.length === 0 && (
          <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4">
            Nothing right now. New requests appear here instantly.
          </div>
        )}
        {requests && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((r) => (
              <RequestCard
                key={r._id}
                booking={r}
                hasActive={!!active}
                onAccept={() => accept({ id: r._id })}
                onDecline={() => decline({ id: r._id })}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AvailabilityToggle({
  config,
  active,
  onChange,
}: {
  config: Doc<"driverConfig"> | null;
  active: Doc<"bookings"> | null;
  onChange: (a: "working" | "off") => void;
}) {
  if (!config) return null;
  const locked = !!active; // can't change while on a trip
  const onJob = config.availability === "on_job" || active;
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400">
            Status
          </div>
          <div className="text-lg font-semibold capitalize">
            {onJob ? "On a trip" : config.availability === "off" ? "Off today" : "Working"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={locked}
          onClick={() => onChange("working")}
          className={
            "flex-1 py-2 rounded-lg text-sm border " +
            (config.availability === "working"
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
              : "bg-slate-900 border-slate-700 text-slate-300") +
            (locked ? " opacity-50" : "")
          }
        >
          Working
        </button>
        <button
          disabled={locked}
          onClick={() => onChange("off")}
          className={
            "flex-1 py-2 rounded-lg text-sm border " +
            (config.availability === "off"
              ? "bg-slate-700/50 border-slate-600 text-slate-100"
              : "bg-slate-900 border-slate-700 text-slate-300") +
            (locked ? " opacity-50" : "")
          }
        >
          Off today
        </button>
      </div>
      {locked && (
        <div className="text-[11px] text-amber-300/80 mt-2">
          Locked while you're on a trip.
        </div>
      )}
    </div>
  );
}

function RequestCard({
  booking,
  hasActive,
  onAccept,
  onDecline,
}: {
  booking: Doc<"bookings">;
  hasActive: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const willQueue = hasActive && booking.scheduledFor === undefined;
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between text-xs">
        <div className="text-slate-400">
          {booking.scheduledFor
            ? "For " + fmtDateTime(booking.scheduledFor)
            : "ASAP"}
        </div>
        <div className="text-slate-400">{relTime(booking._creationTime)}</div>
      </div>
      <div className="mt-2 text-sm">
        <div className="text-slate-200">
          <span className="text-emerald-400">●</span> {booking.pickupZone}
          {booking.pickupDetail && (
            <span className="text-slate-500 text-xs"> — {booking.pickupDetail}</span>
          )}
        </div>
        <div className="text-slate-200">
          <span className="text-rose-400">●</span> {booking.dropoffZone}
          {booking.dropoffDetail && (
            <span className="text-slate-500 text-xs"> — {booking.dropoffDetail}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <span className="text-amber-300 font-semibold">{fmtMoney(booking.price)}</span>
      </div>
      {booking.notes && (
        <div className="mt-2 text-xs bg-slate-800 rounded-lg p-2 text-slate-300">
          &ldquo;{booking.notes}&rdquo;
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
        >
          {willQueue ? "Accept (add to queue)" : "Accept"}
        </button>
        <button
          onClick={onDecline}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-rose-300 text-sm"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function ActiveTripCard({
  booking,
  onAdvance,
}: {
  booking: Doc<"bookings">;
  onAdvance: (
    to: "on_the_way" | "arrived" | "in_progress" | "completed" | "no_show",
  ) => void;
}) {
  const buttons: { label: string; cls: string; to: Parameters<typeof onAdvance>[0] }[] = [];
  if (booking.status === "on_the_way") {
    buttons.push({
      label: "🔔 I've arrived",
      cls: "bg-rose-500 text-white",
      to: "arrived",
    });
    buttons.push({
      label: "Start trip",
      cls: "bg-amber-500 text-slate-950",
      to: "in_progress",
    });
  } else if (booking.status === "arrived") {
    buttons.push({
      label: "Start trip",
      cls: "bg-amber-500 text-slate-950",
      to: "in_progress",
    });
    buttons.push({
      label: "No-show",
      cls: "bg-slate-800 border border-slate-700 text-rose-300",
      to: "no_show",
    });
  } else if (booking.status === "in_progress") {
    buttons.push({
      label: "End trip",
      cls: "bg-emerald-500 text-slate-950",
      to: "completed",
    });
  }
  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-500/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-amber-300">
          Active trip
        </div>
        <div className="text-xs text-amber-200">{fmtMoney(booking.price)}</div>
      </div>
      <div className="text-sm mt-2 space-y-1">
        <div>
          <span className="text-emerald-400">●</span> {booking.pickupZone}
          {booking.pickupDetail && (
            <span className="text-slate-500 text-xs"> — {booking.pickupDetail}</span>
          )}
        </div>
        <div>
          <span className="text-rose-400">●</span> {booking.dropoffZone}
          {booking.dropoffDetail && (
            <span className="text-slate-500 text-xs"> — {booking.dropoffDetail}</span>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {buttons.map((b, i) => (
          <button
            key={i}
            onClick={() => onAdvance(b.to)}
            className={"w-full py-3 rounded-xl font-semibold text-sm " + b.cls}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UpNextCard({
  queue,
  hasActive,
  onStart,
}: {
  queue: Doc<"bookings">[];
  hasActive: boolean;
  onStart: (id: Id<"bookings">) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
        Up next ({queue.length})
      </div>
      <div className="space-y-2">
        {queue.map((b, i) => {
          const t = b.scheduledFor ?? b._creationTime;
          const isQueued = b.status === "queued";
          const isNext = i === 0;
          // Driver can start the very next accepted booking if they're not
          // already on a trip. Queued bookings have to wait their turn.
          const canStart = isNext && !hasActive && b.status === "accepted";
          return (
            <div
              key={b._id}
              className={
                "rounded-xl p-3 border " +
                (isNext
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-slate-950 border-slate-800")
              }
            >
              <div className="flex items-center justify-between text-sm">
                <span>
                  {b.pickupZone} → {b.dropoffZone}
                </span>
                <span
                  className={
                    "text-xs whitespace-nowrap " +
                    (isNext ? "text-amber-300 font-semibold" : "text-slate-400")
                  }
                >
                  {isQueued && hasActive ? "after current" : countdownLabel(t)}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {fmtMoney(b.price)}
              </div>
              {canStart && (
                <button
                  onClick={() => onStart(b._id)}
                  className="mt-2 w-full py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
                >
                  Start this trip — I&apos;m on the way
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

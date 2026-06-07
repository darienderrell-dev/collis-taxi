"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtMoney, fmtDateTime, relTime } from "@/lib/fmt";

const STAGES = [
  { key: "requested", label: "Request sent", desc: "Waiting for driver to accept" },
  { key: "accepted", label: "Accepted", desc: "Driver confirmed your ride" },
  { key: "queued", label: "In queue", desc: "Driver is finishing another trip first" },
  { key: "on_the_way", label: "On the way", desc: "Driver is coming to your pickup" },
  { key: "arrived", label: "Driver has arrived", desc: "Come outside!" },
  { key: "in_progress", label: "Trip started", desc: "Enjoy the ride" },
  { key: "completed", label: "Trip complete", desc: "Thanks for riding" },
] as const;

export default function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const booking = useQuery(api.bookings.getById, {
    id: id as Id<"bookings">,
  });
  const events = useQuery(api.bookings.eventsForBooking, {
    bookingId: id as Id<"bookings">,
  });
  const driverConfig = useQuery(api.driverConfig.get);
  const cancel = useMutation(api.bookings.cancelByClient);

  if (booking === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading…</div>
      </main>
    );
  }
  if (booking === null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-2xl mb-2">😕</div>
          <div className="text-lg font-semibold">Trip not found</div>
          <Link href="/" className="text-sm text-amber-400 underline mt-4 inline-block">
            Go home
          </Link>
        </div>
      </main>
    );
  }

  // Build the flow for this booking. Queued bookings see the queue stage,
  // accepted bookings see the accepted stage. Everyone else sees the rest.
  const flow =
    booking.status === "queued"
      ? STAGES.filter((s) => s.key !== "accepted")
      : STAGES.filter((s) => s.key !== "queued");
  const isOver = ["completed", "cancelled", "declined", "no_show"].includes(
    booking.status,
  );
  // For completed, mark every stage done. For other terminal states (cancelled,
  // declined, no_show) the trip didn't finish — leave findIndex as-is, but
  // never default to 0 (which would falsely highlight "Request sent").
  const rawIdx = flow.findIndex((s) => s.key === booking.status);
  const currentIdx =
    booking.status === "completed"
      ? flow.length - 1
      : rawIdx === -1
      ? -1
      : rawIdx;
  const canCancel = !["completed", "cancelled", "in_progress", "arrived", "no_show", "declined"].includes(
    booking.status,
  );

  return (
    <main className="min-h-dvh flex items-start justify-center p-6 pb-safe-with-install">
      <div className="max-w-md w-full pt-8">
        <Link href="/" className="text-slate-400 text-sm">← Home</Link>

        <div className="text-xs uppercase tracking-wider text-slate-400 mt-6">
          Your booking
        </div>
        <div className="text-lg font-semibold mt-1">
          {booking.pickupZone} → {booking.dropoffZone}
        </div>
        {(booking.pickupDetail || booking.dropoffDetail) && (
          <div className="text-xs text-slate-400 mt-1 space-y-0.5">
            {booking.pickupDetail && (
              <div>
                <span className="text-emerald-400">●</span> {booking.pickupDetail}
              </div>
            )}
            {booking.dropoffDetail && (
              <div>
                <span className="text-rose-400">●</span> {booking.dropoffDetail}
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-slate-500 mt-1">
          {booking.scheduledFor
            ? "Scheduled for " + fmtDateTime(booking.scheduledFor)
            : "ASAP"}
          {" • "}
          {fmtMoney(booking.price)}
        </div>

        {/* Driver info card — shows once accepted */}
        {!["requested", "completed", "cancelled", "declined"].includes(
          booking.status,
        ) && driverConfig && <DriverInfo config={driverConfig} />}

        {/* Arrival alert */}
        {booking.status === "arrived" && (
          <div className="mt-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 p-5">
            <div className="text-xs uppercase tracking-wider text-rose-300">
              🔔 Driver is here
            </div>
            <div className="text-xl font-semibold text-rose-100 mt-1">
              Come outside now
            </div>
          </div>
        )}

        {/* Banner for non-completion terminal states */}
        {isOver && booking.status !== "completed" && (
          <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-3 text-sm text-slate-300">
            Trip {booking.status.replace(/_/g, " ")}.
          </div>
        )}

        {/* Timeline */}
        <div className="mt-6 space-y-4">
          {flow.map((s, i) => {
            const done = currentIdx >= 0 && i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      "w-3 h-3 rounded-full " +
                      (done
                        ? "bg-emerald-400"
                        : active
                        ? "bg-amber-400"
                        : "bg-slate-700")
                    }
                  />
                  {i < flow.length - 1 && (
                    <div
                      className={
                        "w-px flex-1 " +
                        (done ? "bg-emerald-400/40" : "bg-slate-800")
                      }
                    />
                  )}
                </div>
                <div className="pb-3">
                  <div
                    className={
                      "text-sm " +
                      (done || active ? "text-slate-100" : "text-slate-500")
                    }
                  >
                    {s.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {active ? s.desc : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {canCancel && (
          <button
            onClick={() => cancel({ id: booking._id })}
            className="mt-6 w-full py-3 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 text-sm"
          >
            Cancel booking
          </button>
        )}

        {/* Event log */}
        {events && events.length > 0 && (
          <details className="mt-6 text-xs">
            <summary className="text-slate-500 cursor-pointer">
              Event log ({events.length})
            </summary>
            <div className="mt-2 space-y-1">
              {events.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5"
                >
                  <span className="text-slate-300">{e.label}</span>
                  <span className="text-slate-500">{relTime(e._creationTime)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {isOver && (
          <div className="mt-6 text-xs text-slate-500 text-center">
            This trip is closed. <Link href="/book" className="text-amber-400 underline">Book another</Link>
          </div>
        )}
      </div>
    </main>
  );
}

function DriverInfo({
  config,
}: {
  config: {
    driverName: string;
    driverPhone?: string;
    vehicle?: string;
    plate?: string;
    driverPhotoUrl?: string;
  };
}) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-3 flex items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
        {config.driverPhotoUrl ? (
          <img src={config.driverPhotoUrl} className="w-full h-full object-cover" alt="" />
        ) : (
          <span className="text-2xl">👨‍✈️</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{config.driverName}</div>
        {config.vehicle && (
          <div className="text-xs text-slate-400 truncate">{config.vehicle}</div>
        )}
        {config.plate && (
          <div className="text-[11px] text-slate-500">Plate {config.plate}</div>
        )}
      </div>
      {config.driverPhone && (
        <a
          href={"tel:" + config.driverPhone}
          className="bg-emerald-500 text-slate-950 font-semibold text-xs rounded-full px-3 py-1.5"
        >
          📞 Call
        </a>
      )}
    </div>
  );
}

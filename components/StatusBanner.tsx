"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * "Is Collis available right now?" banner shown on the client home.
 * Combines two queries:
 *   - driverConfig.get for the driver's name + on_job state
 *   - bookings.availabilityNow for the computed state (work hours,
 *     work days, blackouts) — the server is the source of truth.
 */
export function StatusBanner() {
  const config = useQuery(api.driverConfig.get);
  const now = useQuery(api.bookings.availabilityNow);

  if (config === undefined || now === undefined) {
    return <Card tone="slate" title="Loading status…" sub="" />;
  }
  if (!config || now.state === "unconfigured") {
    return (
      <Card
        tone="slate"
        title="Service not set up"
        sub="Check back soon."
      />
    );
  }

  const name = config.driverName;

  // Active trip beats other states — "on a trip" is visible info for the
  // booking flow ("you'll join the queue").
  if (config.availability === "on_job") {
    return (
      <Card
        tone="amber"
        pulse
        title={`${name} is on a trip right now`}
        sub="Book now to join the queue, or schedule for later."
      />
    );
  }

  if (now.state === "off") {
    return (
      <Card
        tone="slate"
        title={`${name} is off today`}
        sub="You can still schedule a ride for tomorrow."
      />
    );
  }
  if (now.state === "outside_hours") {
    return (
      <Card
        tone="slate"
        title={`${name} is off right now`}
        sub={`Working hours ${now.start} – ${now.end}. Schedule a ride for later.`}
      />
    );
  }
  if (now.state === "blackout") {
    const back = new Date(now.endAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <Card
        tone="amber"
        title={`${name} is unavailable${now.label ? ` — ${now.label}` : ""}`}
        sub={`Back at ${back}. You can still schedule a ride.`}
      />
    );
  }

  return (
    <Card
      tone="emerald"
      pulse
      title={`${name} is available now`}
      sub={`Working hours ${config.workHoursStart} – ${config.workHoursEnd}`}
    />
  );
}

function Card({
  tone,
  title,
  sub,
  pulse,
}: {
  tone: "slate" | "amber" | "emerald";
  title: string;
  sub: string;
  pulse?: boolean;
}) {
  const styles = {
    slate: "bg-slate-900 border-slate-800 text-slate-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
  }[tone];
  const dotColor = {
    slate: "bg-slate-500",
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
  }[tone];
  return (
    <div className={"rounded-2xl border p-4 flex items-center gap-3 " + styles}>
      {pulse && (
        <span
          className={"inline-block w-2.5 h-2.5 rounded-full " + dotColor}
          style={{ animation: "pulse 1.6s ease-out infinite" }}
        />
      )}
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        {sub && <div className="text-xs opacity-80 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

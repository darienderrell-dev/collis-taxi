"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Tiny "is Collis available right now?" banner shown on the client home.
 * Source of truth is the singleton driverConfig row.
 */
export function StatusBanner() {
  const config = useQuery(api.driverConfig.get);

  if (config === undefined) {
    return <Card tone="slate" title="Loading status…" sub="" />;
  }
  if (!config) {
    return (
      <Card
        tone="slate"
        title="Driver not set up"
        sub="Ask the operator to seed the database."
      />
    );
  }

  if (config.availability === "off") {
    return (
      <Card
        tone="slate"
        title={`${config.driverName} is off today`}
        sub="You can still schedule a ride for later."
      />
    );
  }
  if (config.availability === "on_job") {
    return (
      <Card
        tone="amber"
        pulse
        title={`${config.driverName} is on a trip right now`}
        sub="Book now to join the queue, or schedule for later."
      />
    );
  }
  return (
    <Card
      tone="emerald"
      pulse
      title={`${config.driverName} is available now`}
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

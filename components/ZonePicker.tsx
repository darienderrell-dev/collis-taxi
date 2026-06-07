"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  label: string;
  icon: string;
  /** Selected zone document id (or null). */
  zoneId: Id<"zones"> | null;
  /** Display name shown in the input (kept in sync with the picked zone). */
  zoneName: string;
  onPick: (zone: { id: Id<"zones">; name: string }) => void;
  onTextChange: (text: string) => void;
  detailLabel?: string;
  detailPlaceholder?: string;
  detail?: string;
  onDetailChange?: (text: string) => void;
};

export function ZonePicker({
  label,
  icon,
  zoneId,
  zoneName,
  onPick,
  onTextChange,
  detailLabel,
  detailPlaceholder,
  detail,
  onDetailChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const zones = useQuery(api.zones.list) ?? [];
  const filtered = zones.filter(
    (z) => !zoneName || z.name.toLowerCase().includes(zoneName.toLowerCase()),
  );

  return (
    <div className="relative">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-amber-500">
        <span>{icon}</span>
        <input
          value={zoneName}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Area (e.g. Mackenzie, Wismar)"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {zoneId && (
          <span className="text-[11px] uppercase tracking-wider text-emerald-300">
            ✓
          </span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl p-2 max-h-56 overflow-auto">
          {filtered.map((z) => (
            <button
              type="button"
              key={z._id}
              onMouseDown={() => {
                onPick({ id: z._id, name: z.name });
                setOpen(false);
              }}
              className="block w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-slate-800"
            >
              {z.name}
            </button>
          ))}
        </div>
      )}
      {detailLabel !== undefined && onDetailChange && (
        <input
          value={detail ?? ""}
          onChange={(e) => onDetailChange(e.target.value)}
          placeholder={detailPlaceholder}
          className="mt-1.5 w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
        />
      )}
    </div>
  );
}

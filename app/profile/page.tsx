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
import { api } from "@/convex/_generated/api";
import { ZonePicker } from "@/components/ZonePicker";
import type { Id } from "@/convex/_generated/dataModel";

const FAVORITES_LIMIT = 3;

export default function ProfilePage() {
  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-md w-full pt-8">
        <AuthLoading>
          <div className="text-sm text-slate-500">Loading…</div>
        </AuthLoading>
        <Unauthenticated>
          <div className="text-sm text-slate-400">
            Please <Link href="/login" className="underline">sign in</Link>.
          </div>
        </Unauthenticated>
        <Authenticated>
          <FavoritesManager />
        </Authenticated>
      </div>
    </main>
  );
}

function FavoritesManager() {
  const me = useQuery(api.users.currentUser);
  const addFavorite = useMutation(api.users.addFavorite);
  const removeFavorite = useMutation(api.users.removeFavorite);

  const [label, setLabel] = useState("");
  const [zoneId, setZoneId] = useState<Id<"zones"> | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [detail, setDetail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!label.trim() || !zoneName.trim()) {
      setErr("Pick a label and an area");
      return;
    }
    try {
      await addFavorite({
        label: label.trim(),
        zoneName: zoneName.trim(),
        detail: detail.trim() || undefined,
      });
      setLabel("");
      setZoneId(null);
      setZoneName("");
      setDetail("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (me === undefined)
    return <div className="text-sm text-slate-500">Loading…</div>;
  if (!me) return null;

  const favorites = me.favorites ?? [];
  const atLimit = favorites.length >= FAVORITES_LIMIT;

  return (
    <>
      <Link href="/" className="text-slate-400 text-sm">
        ← Home
      </Link>
      <div className="text-2xl font-semibold mt-4 mb-1">My favorite places</div>
      <div className="text-sm text-slate-400 mb-5">
        Save up to {FAVORITES_LIMIT} places for one-tap booking.
      </div>

      <div className="space-y-2 mb-6">
        {favorites.length === 0 && (
          <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
            No favorites yet — add one below.
          </div>
        )}
        {favorites.map((f) => (
          <div
            key={f.id}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">⭐ {f.label}</div>
              <div className="text-xs text-slate-400 truncate">
                {f.zoneName}
                {f.detail && " • " + f.detail}
              </div>
            </div>
            <button
              onClick={() => removeFavorite({ id: f.id })}
              className="text-rose-400 text-lg leading-none px-2"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {!atLimit && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="text-sm font-medium mb-3">Add a new favorite</div>
          <div className="space-y-3">
            <label className="block">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                Label
              </div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Home, Work, Church"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            <ZonePicker
              label="Area"
              icon="📍"
              zoneId={zoneId}
              zoneName={zoneName}
              onTextChange={(t) => {
                setZoneName(t);
                setZoneId(null);
              }}
              onPick={({ id, name }) => {
                setZoneId(id);
                setZoneName(name);
              }}
              detailLabel="Specific spot (optional)"
              detailPlaceholder="e.g. House #45, blue gate"
              detail={detail}
              onDetailChange={setDetail}
            />
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button
              onClick={save}
              className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-semibold"
            >
              Save favorite
            </button>
          </div>
        </div>
      )}

      {atLimit && (
        <div className="text-xs text-slate-500 text-center">
          You&apos;ve hit the {FAVORITES_LIMIT}-favorite limit. Remove one to add
          another.
        </div>
      )}
    </>
  );
}

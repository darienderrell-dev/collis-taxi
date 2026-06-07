"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/nextjs";
import { api } from "@/convex/_generated/api";
import { StatusBanner } from "@/components/StatusBanner";
import { fmtMoney, relTime, weekdayLabel } from "@/lib/fmt";
import type { Doc } from "@/convex/_generated/dataModel";

export default function HomePage() {
  return (
    <main className="min-h-dvh flex items-start justify-center p-6 pb-safe-with-install">
      <div className="max-w-md w-full pt-8">
        <header className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl">
            🚕
          </div>
          <div>
            <div className="text-2xl font-semibold">Collis Taxi</div>
            <div className="text-sm text-slate-400">Linden, Guyana</div>
          </div>
        </header>

        <AuthLoading>
          <div className="text-sm text-slate-500">Checking sign-in…</div>
        </AuthLoading>

        <Unauthenticated>
          <SignedOut />
        </Unauthenticated>

        <Authenticated>
          <SignedIn />
        </Authenticated>
      </div>
    </main>
  );
}

function SignedOut() {
  return (
    <div className="space-y-3">
      <Link
        href="/login"
        className="block w-full text-center py-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-semibold text-lg shadow-lg shadow-amber-900/40 hover:brightness-110 transition"
      >
        Sign in / Sign up
      </Link>
      <div className="text-xs text-slate-500 text-center pt-4">
        Quick. Just your name and phone.
      </div>
    </div>
  );
}

function SignedIn() {
  const me = useQuery(api.users.currentUser);
  const router = useRouter();

  // Role-based auto-redirect
  useEffect(() => {
    if (!me) return;
    if (me.role === "admin") router.replace("/admin");
    else if (me.role === "driver") router.replace("/driver");
  }, [me, router]);

  if (me === undefined) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!me) return null;
  if (me.role !== "client") {
    return (
      <div className="text-sm text-slate-400">Redirecting to dashboard…</div>
    );
  }
  return <ClientHome me={me} />;
}

function ClientHome({ me }: { me: Doc<"users"> }) {
  const myActive = useQuery(api.bookings.myActiveBooking);
  const myTrips = useQuery(api.bookings.listMine);
  const mySeries = useQuery(api.recurring.listMine);
  const cancelBooking = useMutation(api.bookings.cancelByClient);
  const cancelSeries = useMutation(api.recurring.cancelSeries);
  const { signOut } = useAuthActions();

  async function quickCancel(id: Doc<"bookings">["_id"]) {
    if (!confirm("Cancel this ride?")) return;
    try {
      await cancelBooking({ id });
    } catch (e) {
      Sentry.captureException(e, {
        tags: { feature: "booking.cancel" },
        extra: { bookingId: id },
      });
      alert(e instanceof Error ? e.message : "Couldn't cancel");
    }
  }
  return (
    <>
      <div className="flex items-center justify-between mb-6 -mt-2">
        <div>
          <div className="text-xs text-slate-400">Hi,</div>
          <div className="text-lg font-semibold">
            {me.name?.split(" ")[0] ?? "there"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/profile" className="text-amber-400 underline">
            Favorites
          </Link>
          <button
            onClick={() => signOut()}
            className="text-slate-400 underline"
          >
            Sign out
          </button>
        </div>
      </div>

      <StatusBanner />

      {myActive ? (
        <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 overflow-hidden">
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-emerald-300">
              You have an active ride
            </div>
            <div className="text-base font-semibold mt-1 text-emerald-100">
              {myActive.pickupZone} → {myActive.dropoffZone}
            </div>
            <div className="text-xs opacity-80 mt-0.5 capitalize text-emerald-200">
              {myActive.status.replace(/_/g, " ")}
            </div>
          </div>
          {/* Action row — explicit, big touch targets so older users can see
              exactly what they can do without hunting. */}
          <div className="flex border-t border-emerald-500/30">
            <Link
              href={`/trips/${myActive._id}`}
              className="flex-1 py-3 text-center text-emerald-50 font-semibold text-sm bg-emerald-500/20 hover:bg-emerald-500/30"
            >
              View ride →
            </Link>
            {!["arrived", "in_progress"].includes(myActive.status) && (
              <button
                onClick={() => quickCancel(myActive._id)}
                className="flex-1 py-3 text-center text-rose-200 font-semibold text-sm border-l border-emerald-500/30 hover:bg-rose-500/10"
              >
                Cancel ride
              </button>
            )}
          </div>
        </div>
      ) : (
        <Link
          href="/book"
          className="mt-5 block w-full text-center py-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-semibold text-lg shadow-lg shadow-amber-900/40 hover:brightness-110 transition"
        >
          Book a ride
        </Link>
      )}

      {/* Weekly rides — only shown if the user has at least one active series. */}
      {mySeries && mySeries.some((s) => s.active) && (
        <div className="mt-8">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
            Your weekly rides
          </div>
          <div className="space-y-2">
            {mySeries
              .filter((s) => s.active)
              .map((s) => (
                <div
                  key={s._id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">
                      {s.pickupZone} → {s.dropoffZone}
                    </div>
                    <div className="text-xs text-amber-300 whitespace-nowrap">
                      ↻ weekly
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="text-slate-400">
                      Every {weekdayLabel(s.dayOfWeek)} at {s.timeOfDay}
                    </div>
                    <div className="text-slate-300">{fmtMoney(s.price)}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          "Stop this weekly ride? Future bookings will be cancelled.",
                        )
                      )
                        return;
                      try {
                        await cancelSeries({ id: s._id });
                      } catch (e) {
                        alert(
                          e instanceof Error
                            ? e.message
                            : "Couldn't cancel series",
                        );
                      }
                    }}
                    className="mt-2 w-full py-2 rounded-lg bg-slate-950 border border-slate-800 text-rose-300 text-xs font-semibold"
                  >
                    Stop weekly ride
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
          Recent trips
        </div>
        {myTrips === undefined && (
          <div className="text-sm text-slate-500">Loading…</div>
        )}
        {myTrips && myTrips.length === 0 && (
          <div className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4">
            No trips yet. Tap &ldquo;Book a ride&rdquo; to get started.
          </div>
        )}
        {myTrips && myTrips.length > 0 && (
          <div className="space-y-2">
            {myTrips.slice(0, 6).map((b) => {
              const closed = ["completed", "cancelled", "declined", "no_show"].includes(
                b.status,
              );
              const bookAgainHref =
                `/book?pickup=${encodeURIComponent(b.pickupZone)}` +
                `&dropoff=${encodeURIComponent(b.dropoffZone)}` +
                (b.pickupDetail
                  ? `&pickupDetail=${encodeURIComponent(b.pickupDetail)}`
                  : "") +
                (b.dropoffDetail
                  ? `&dropoffDetail=${encodeURIComponent(b.dropoffDetail)}`
                  : "") +
                (b.notes ? `&notes=${encodeURIComponent(b.notes)}` : "");
              return (
                <div
                  key={b._id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/trips/${b._id}`}
                      className="flex-1 min-w-0 text-sm font-medium truncate hover:text-amber-300"
                    >
                      {b.pickupZone} → {b.dropoffZone}
                    </Link>
                    <div className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-2">
                      {relTime(b._creationTime)}
                      {closed && (
                        <Link
                          href={bookAgainHref}
                          title="Book again"
                          className="text-amber-400 text-base leading-none px-1"
                        >
                          ↻
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      {b.status.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-slate-300">
                      {fmtMoney(b.price)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

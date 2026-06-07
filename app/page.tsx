"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { StatusBanner } from "@/components/StatusBanner";
import { fmtMoney, relTime } from "@/lib/fmt";
import type { Doc } from "@/convex/_generated/dataModel";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-start justify-center p-6">
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
  const { signOut } = useAuthActions();
  return (
    <>
      <div className="flex items-center justify-between mb-6 -mt-2">
        <div>
          <div className="text-xs text-slate-400">Hi,</div>
          <div className="text-lg font-semibold">
            {me.name?.split(" ")[0] ?? "there"}
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="text-xs text-slate-400 underline"
        >
          Sign out
        </button>
      </div>

      <StatusBanner />

      {myActive ? (
        <Link
          href={`/trips/${myActive._id}`}
          className="mt-4 block w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
        >
          <div className="text-xs uppercase tracking-wider text-emerald-300">
            You have an active booking
          </div>
          <div className="text-sm font-medium mt-0.5">
            {myActive.pickupZone} → {myActive.dropoffZone}
          </div>
          <div className="text-xs opacity-80 mt-0.5 capitalize">
            {myActive.status.replace(/_/g, " ")} • tap to track
          </div>
        </Link>
      ) : (
        <Link
          href="/book"
          className="mt-5 block w-full text-center py-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-semibold text-lg shadow-lg shadow-amber-900/40 hover:brightness-110 transition"
        >
          Book a ride
        </Link>
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
            {myTrips.slice(0, 6).map((b) => (
              <Link
                key={b._id}
                href={`/trips/${b._id}`}
                className="block p-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">
                    {b.pickupZone} → {b.dropoffZone}
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {relTime(b._creationTime)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs uppercase tracking-wider text-slate-500">
                    {b.status.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-slate-300">{fmtMoney(b.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

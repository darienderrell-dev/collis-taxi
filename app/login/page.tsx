"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { deriveCredentialsForPhone } from "./credentials";

// Same normalization as the server-side helper.
// Keep them in sync — see app/login/credentials.ts.
function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "DRIVER" || trimmed === "ADMIN") return trimmed;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return (hasPlus ? "+" : "") + digits;
}

export default function LoginPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const convex = useConvex();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !phone.trim()) {
      setErr("Please enter your name and phone");
      return;
    }
    startTransition(async () => {
      try {
        const { email, password } = await deriveCredentialsForPhone(phone);
        const normalized = normalizePhone(phone);

        // Decide flow based on whether the phone already exists. Cleaner than
        // try-signIn-then-signUp because Convex Auth doesn't always reject
        // missing accounts as throwable errors.
        const exists = await convex.query(api.users.existsForPhone, {
          phone: normalized,
        });

        // Convex Auth's React hook in some versions throws a TypeError when
        // the underlying signIn returns null even though the auth succeeded
        // server-side. We swallow ONLY that specific error and trust that the
        // Authenticated wrapper on `/` will reflect the new session.
        async function safeSignIn(params: Record<string, string>) {
          try {
            await signIn("password", params);
          } catch (err) {
            if (
              err instanceof TypeError &&
              /reading 'redirect'/.test(err.message)
            ) {
              // benign — auth already succeeded
              return;
            }
            throw err;
          }
        }

        if (exists) {
          await safeSignIn({ email, password, flow: "signIn" });
        } else {
          await safeSignIn({
            email,
            password,
            flow: "signUp",
            name: name.trim(),
            phone: normalized,
            role: "client",
          });
        }
        router.push("/");
        router.refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sign-in failed";
        setErr(msg);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-md w-full pt-12">
        <Link href="/" className="text-slate-400 text-sm">
          ← Back
        </Link>
        <div className="flex items-center gap-3 my-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl">
            🚕
          </div>
          <div>
            <div className="text-2xl font-semibold">Welcome to Collis Taxi</div>
            <div className="text-sm text-slate-400">Book a trusted local driver</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
              Your name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aisha Persaud"
              autoComplete="name"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
              Phone number
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+592 ..."
              autoComplete="tel"
              inputMode="tel"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500"
            />
          </label>

          {err && (
            <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-semibold text-base disabled:opacity-50"
          >
            {isPending ? "Signing you in…" : "Continue"}
          </button>
        </form>

        <div className="text-xs text-slate-500 text-center pt-6">
          If you've signed up before with this phone, you'll be signed back in.
        </div>
      </div>
    </main>
  );
}

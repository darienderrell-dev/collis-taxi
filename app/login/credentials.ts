"use server";

import { createHash } from "node:crypto";

/**
 * Normalize an input. Numeric phones get stripped to digits (with optional `+`).
 * Special staff strings like "DRIVER" or "ADMIN" pass through unchanged.
 * (Not exported — `"use server"` requires every export to be an async server action.)
 */
function normalizeIdentifier(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "DRIVER" || trimmed === "ADMIN") return trimmed;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return (hasPlus ? "+" : "") + digits;
}

/**
 * Server-only: derives the {email, password} the client uses with Convex Auth's
 * Password provider, based on a per-phone hash of PHONE_AUTH_SECRET.
 *
 * - Email is synthesized so the user never sees one (just name + phone in UI).
 * - Password is deterministic so the same phone can sign back in from any device
 *   without SMS verification. PHONE_AUTH_SECRET never leaves the server.
 * - Staff phones ("DRIVER", "ADMIN") get a lowercase local-part email.
 */
export async function deriveCredentialsForPhone(
  phone: string,
): Promise<{ email: string; password: string }> {
  const secret = process.env.PHONE_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "PHONE_AUTH_SECRET is not set. Add it to .env.local (any long random hex string).",
    );
  }
  const normalized = normalizeIdentifier(phone);

  // Email local-part: digits for numeric phones, lowercase string for staff
  let localPart: string;
  if (normalized === "DRIVER" || normalized === "ADMIN") {
    localPart = normalized.toLowerCase();
  } else {
    localPart = normalized.replace(/\D/g, "");
    if (localPart.length < 6) throw new Error("Phone looks too short");
  }

  const email = `${localPart}@collis.local`;
  const password = createHash("sha256")
    .update(`${secret}:${normalized}`)
    .digest("hex");
  return { email, password };
}

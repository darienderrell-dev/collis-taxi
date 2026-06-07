import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns the currently signed-in user's profile, or `null` if not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Checks whether a user already exists for this phone number. Used by the
 * login page to decide between sign-in vs sign-up flows.
 */
export const existsForPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", phone))
      .first();
    return !!user;
  },
});

/**
 * Internal helper for other functions: returns the userId or throws.
 */
export async function requireUserId(ctx: { auth: any; db: any }) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

/**
 * Internal helper: throws unless the caller is a driver or admin.
 */
export async function requireStaff(ctx: { auth: any; db: any }) {
  const userId = await requireUserId(ctx);
  const user = await (ctx.db as any).get(userId);
  if (!user || (user.role !== "driver" && user.role !== "admin")) {
    throw new Error("Forbidden — staff only");
  }
  return userId;
}

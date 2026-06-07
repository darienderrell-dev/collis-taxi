import { mutation, query } from "./_generated/server";
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

const FAVORITES_LIMIT = 3;

/**
 * Add a favorite to the current user's list (max 3).
 */
export const addFavorite = mutation({
  args: {
    label: v.string(),
    zoneName: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User missing");
    const existing = user.favorites ?? [];
    if (existing.length >= FAVORITES_LIMIT) {
      throw new Error(`You can save up to ${FAVORITES_LIMIT} favorites`);
    }
    const next = [
      ...existing,
      {
        id: Math.random().toString(36).slice(2, 10),
        label: args.label.trim(),
        zoneName: args.zoneName.trim(),
        detail: args.detail?.trim() || undefined,
      },
    ];
    await ctx.db.patch(userId, { favorites: next });
  },
});

/**
 * Remove a favorite from the current user's list.
 */
export const removeFavorite = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User missing");
    const next = (user.favorites ?? []).filter((f) => f.id !== id);
    await ctx.db.patch(userId, { favorites: next });
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

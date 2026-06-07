import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./users";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("driverConfig").first();
  },
});

export const update = mutation({
  args: {
    availability: v.optional(
      v.union(v.literal("working"), v.literal("off"), v.literal("on_job")),
    ),
    workDays: v.optional(v.array(v.number())),
    workHoursStart: v.optional(v.string()),
    workHoursEnd: v.optional(v.string()),
    slotMinutes: v.optional(v.number()),
    driverName: v.optional(v.string()),
    driverPhone: v.optional(v.string()),
    driverPhotoUrl: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    plate: v.optional(v.string()),
  },
  handler: async (ctx, patch) => {
    await requireStaff(ctx);
    const row = await ctx.db.query("driverConfig").first();
    if (!row) throw new Error("driverConfig not seeded yet");
    // Only patch with defined fields
    const cleanPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleanPatch[k] = v;
    }
    await ctx.db.patch(row._id, cleanPatch);
  },
});

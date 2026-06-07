import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("driverBlackouts").collect();
    rows.sort((a, b) => a.startAt - b.startAt);
    return rows;
  },
});

export const create = mutation({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { startAt, endAt, label }) => {
    await requireStaff(ctx);
    if (endAt <= startAt) throw new Error("endAt must be after startAt");
    return await ctx.db.insert("driverBlackouts", { startAt, endAt, label });
  },
});

export const remove = mutation({
  args: { id: v.id("driverBlackouts") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    await ctx.db.delete(id);
  },
});

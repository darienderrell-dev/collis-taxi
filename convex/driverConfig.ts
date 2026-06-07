import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./users";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("driverConfig").first();
    if (!row) return null;
    // Resolve uploaded photo (storage) to a URL, falling back to the
    // legacy pasted-URL field. Callers shouldn't have to care which
    // path the photo came from.
    let photoUrl: string | null = row.driverPhotoUrl ?? null;
    if (row.driverPhotoStorageId) {
      const resolved = await ctx.storage.getUrl(row.driverPhotoStorageId);
      if (resolved) photoUrl = resolved;
    }
    return { ...row, driverPhotoUrl: photoUrl ?? undefined };
  },
});

/**
 * Generates a one-time URL the driver settings page POSTs the photo to.
 * Convex returns a storageId, which we then save via setPhoto.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save the uploaded photo's storageId on driverConfig (and clear the
 * legacy URL so the storage path wins). Old storage objects from
 * previous uploads are deleted so we don't pay for orphans.
 */
export const setPhoto = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireStaff(ctx);
    const row = await ctx.db.query("driverConfig").first();
    if (!row) throw new Error("driverConfig not seeded yet");
    if (row.driverPhotoStorageId && row.driverPhotoStorageId !== storageId) {
      await ctx.storage.delete(row.driverPhotoStorageId);
    }
    await ctx.db.patch(row._id, {
      driverPhotoStorageId: storageId,
      driverPhotoUrl: undefined,
    });
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

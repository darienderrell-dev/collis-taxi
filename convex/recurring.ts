import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireUserId } from "./users";

// ----------------------------------------------------------------------
// Recurring weekly bookings.
//
// Concept: a `recurringSeries` row describes "I want a ride from A to B
// every Monday at 8 AM, G$1500." A daily Convex cron materializes
// concrete `bookings` rows for the next 14 days so:
//   - The passenger sees their upcoming rides in trip history.
//   - The driver gets the same accept/decline flow per occurrence,
//     so he can decline an individual week without killing the series.
//   - Cancelling the series cancels future un-started bookings.
//
// We use 14 days of lookahead so a missed cron run (Convex outage,
// failed deploy) doesn't lose a passenger's standing booking.
// ----------------------------------------------------------------------

const LOOKAHEAD_DAYS = 14;

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("recurringSeries")
      .withIndex("by_client", (q) => q.eq("clientUserId", userId))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

export const createSeries = mutation({
  args: {
    pickupZone: v.string(),
    pickupDetail: v.optional(v.string()),
    dropoffZone: v.string(),
    dropoffDetail: v.optional(v.string()),
    dayOfWeek: v.number(),
    timeOfDay: v.string(),
    notes: v.optional(v.string()),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    // Basic validation: dayOfWeek in [0..6], timeOfDay parses as HH:MM.
    if (args.dayOfWeek < 0 || args.dayOfWeek > 6) {
      throw new Error("Invalid day of week");
    }
    if (!/^\d{2}:\d{2}$/.test(args.timeOfDay)) {
      throw new Error("Invalid time of day — use HH:MM");
    }
    const id = await ctx.db.insert("recurringSeries", {
      clientUserId: userId,
      pickupZone: args.pickupZone,
      pickupDetail: args.pickupDetail,
      dropoffZone: args.dropoffZone,
      dropoffDetail: args.dropoffDetail,
      dayOfWeek: args.dayOfWeek,
      timeOfDay: args.timeOfDay,
      notes: args.notes,
      price: args.price,
      active: true,
    });
    // Materialize immediately so the first occurrence shows up without
    // waiting for the next cron run.
    const seriesDoc = await ctx.db.get(id);
    if (seriesDoc) await materializeForSeries(ctx, seriesDoc);
    return id;
  },
});

export const cancelSeries = mutation({
  args: { id: v.id("recurringSeries") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const s = await ctx.db.get(id);
    if (!s) throw new Error("Series not found");
    if (s.clientUserId !== userId) throw new Error("Not your series");
    await ctx.db.patch(id, { active: false });

    // Cancel future occurrences that haven't been started yet so they
    // stop showing up in the queue / driver dashboard.
    const futures = await ctx.db
      .query("bookings")
      .withIndex("by_series", (q) => q.eq("seriesId", id))
      .collect();
    const cancellable = futures.filter(
      (b) =>
        ["requested", "accepted", "queued"].includes(b.status) &&
        b.scheduledFor !== undefined &&
        b.scheduledFor > Date.now(),
    );
    for (const b of cancellable) {
      await ctx.db.patch(b._id, { status: "cancelled" });
      await ctx.db.insert("bookingEvents", {
        bookingId: b._id,
        label: "Cancelled (weekly series ended)",
      });
    }
  },
});

/**
 * Daily cron: walk every active series and ensure bookings exist for
 * each occurrence in the next LOOKAHEAD_DAYS window. Idempotent — if a
 * booking already exists at the target time with this seriesId, skip it.
 */
export const materializeRecurringSeries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const series = await ctx.db
      .query("recurringSeries")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    let created = 0;
    for (const s of series) {
      created += await materializeForSeries(ctx, s);
    }
    return { created };
  },
});

/**
 * Shared helper used by the cron and by createSeries on its first run.
 * Returns the number of bookings created.
 */
async function materializeForSeries(
  ctx: MutationCtx,
  series: Doc<"recurringSeries">,
): Promise<number> {
  if (!series.active) return 0;
  const [hh, mm] = series.timeOfDay.split(":").map(Number);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  let created = 0;
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const day = new Date(startOfToday);
    day.setDate(startOfToday.getDate() + i);
    if (day.getDay() !== series.dayOfWeek) continue;
    day.setHours(hh, mm, 0, 0);
    if (day.getTime() <= now.getTime()) continue; // skip past times

    // Idempotency: does a booking already exist for this series at this time?
    const existing = await ctx.db
      .query("bookings")
      .withIndex("by_series", (q) => q.eq("seriesId", series._id))
      .collect();
    const dup = existing.find(
      (b) => b.scheduledFor === day.getTime(),
    );
    if (dup) continue;

    const newId = await ctx.db.insert("bookings", {
      clientUserId: series.clientUserId,
      pickupZone: series.pickupZone,
      pickupDetail: series.pickupDetail,
      dropoffZone: series.dropoffZone,
      dropoffDetail: series.dropoffDetail,
      scheduledFor: day.getTime(),
      notes: series.notes,
      status: "requested",
      price: series.price,
      seriesId: series._id,
    });
    await ctx.db.insert("bookingEvents", {
      bookingId: newId,
      label: "Auto-created from weekly series",
    });
    created++;
  }
  return created;
}

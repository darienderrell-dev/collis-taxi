import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireUserId } from "./users";

// ---------- queries ----------

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_client", (q) => q.eq("clientUserId", userId))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

/**
 * The booking with the given ID — only visible to the client who owns it,
 * or to staff. Returns null if not found / not allowed.
 */
export const getById = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) return null;
    if (booking.clientUserId === userId) return booking;
    const me = await ctx.db.get(userId);
    if (me?.role === "driver" || me?.role === "admin") return booking;
    return null;
  },
});

/**
 * The current client's latest active booking, if any. "Active" =
 * still in flight (any status before completion or cancellation).
 */
export const myActiveBooking = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_client", (q) => q.eq("clientUserId", userId))
      .collect();
    const live = rows
      .filter((b) =>
        ["requested", "accepted", "queued", "on_the_way", "arrived", "in_progress"].includes(
          b.status,
        ),
      )
      .sort((a, b) => b._creationTime - a._creationTime);
    return live[0] ?? null;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("bookings").collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

export const incomingRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "requested"))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

/**
 * The trip the driver is currently on (on_the_way / arrived / in_progress).
 * Returns null if free.
 */
export const activeTrip = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("bookings").collect();
    return (
      all.find((b) =>
        ["on_the_way", "arrived", "in_progress"].includes(b.status),
      ) ?? null
    );
  },
});

/**
 * Bookings the driver has accepted but hasn't started yet, ordered by
 * scheduled pickup (or creation time for ASAP).
 */
export const upNext = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("bookings").collect();
    const lined = all
      .filter((b) => ["accepted", "queued"].includes(b.status))
      .sort((a, b) => {
        const ta = a.scheduledFor ?? a._creationTime;
        const tb = b.scheduledFor ?? b._creationTime;
        return ta - tb;
      });
    return lined;
  },
});

export const queueDepth = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("bookings").collect();
    return all.filter((b) => b.status === "queued").length;
  },
});

export const eventsForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await requireUserId(ctx);
    const booking = await ctx.db.get(bookingId);
    if (!booking) return [];
    const me = await ctx.db.get(userId);
    const isStaff = me?.role === "driver" || me?.role === "admin";
    if (!isStaff && booking.clientUserId !== userId) return [];
    const events = await ctx.db
      .query("bookingEvents")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
    events.sort((a, b) => a._creationTime - b._creationTime);
    return events;
  },
});

// ---------- mutations ----------

export const create = mutation({
  args: {
    pickupZone: v.string(),
    pickupDetail: v.optional(v.string()),
    dropoffZone: v.string(),
    dropoffDetail: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    notes: v.optional(v.string()),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("bookings", {
      clientUserId: userId,
      pickupZone: args.pickupZone,
      pickupDetail: args.pickupDetail,
      dropoffZone: args.dropoffZone,
      dropoffDetail: args.dropoffDetail,
      scheduledFor: args.scheduledFor,
      notes: args.notes,
      status: "requested",
      price: args.price,
    });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: "Ride requested",
    });
    return id;
  },
});

export const cancelByClient = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.clientUserId !== userId) throw new Error("Not your booking");
    await ctx.db.patch(id, { status: "cancelled" });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: "Cancelled by client",
    });
  },
});

/**
 * Driver accepts a request. If another trip is active and this is an ASAP
 * request, route it to the queue instead of the active spot.
 */
export const driverAccept = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "requested") {
      throw new Error("Only requested bookings can be accepted");
    }
    const all = await ctx.db.query("bookings").collect();
    const hasActive = all.some((b) =>
      ["on_the_way", "arrived", "in_progress"].includes(b.status),
    );
    const newStatus =
      hasActive && booking.scheduledFor === undefined ? "queued" : "accepted";
    await ctx.db.patch(id, { status: newStatus });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: hasActive ? "Driver accepted — added to queue" : "Driver accepted",
    });
  },
});

export const driverDecline = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    await ctx.db.patch(id, { status: "declined" });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: "Driver declined",
    });
  },
});

/**
 * Generic staff transition for the in-flight trip lifecycle.
 * Promotes the next queued booking when a trip completes / no-shows.
 */
export const driverTransition = mutation({
  args: {
    id: v.id("bookings"),
    to: v.union(
      v.literal("on_the_way"),
      v.literal("arrived"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("no_show"),
    ),
  },
  handler: async (ctx, { id, to }) => {
    await requireStaff(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    await ctx.db.patch(id, { status: to });
    const labels: Record<typeof to, string> = {
      on_the_way: "Driver on the way",
      arrived: "Driver arrived",
      in_progress: "Trip started",
      completed: "Trip completed",
      no_show: "Marked no-show",
    };
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: labels[to],
    });

    // When a trip ends, promote the next queued booking to accepted.
    if (to === "completed" || to === "no_show") {
      const all = await ctx.db.query("bookings").collect();
      const next = all
        .filter((b) => b.status === "queued")
        .sort((a, b) => a._creationTime - b._creationTime)[0];
      if (next) {
        await ctx.db.patch(next._id, { status: "accepted" });
        await ctx.db.insert("bookingEvents", {
          bookingId: next._id,
          label: "Promoted from queue",
        });
      }
    }
  },
});

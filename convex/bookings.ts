import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireStaff, requireUserId } from "./users";

// ---------- helpers ----------

/**
 * Attach client name + phone to a booking row for staff views.
 * The driver needs to know who booked them so they can call/text the
 * passenger. We never expose this to other clients — only callers that
 * have already passed requireStaff() should use this helper.
 */
async function attachClient(ctx: QueryCtx, booking: Doc<"bookings">) {
  const client = await ctx.db.get(booking.clientUserId);
  // Lifetime completed trip count for this passenger — drives the ⭐ Regular
  // badge on driver cards so Collis can recognize his repeat customers.
  const clientTrips = await ctx.db
    .query("bookings")
    .withIndex("by_client", (q) => q.eq("clientUserId", booking.clientUserId))
    .collect();
  const completedCount = clientTrips.filter(
    (b) => b.status === "completed",
  ).length;
  return {
    ...booking,
    clientName: client?.name,
    clientPhone: client?.phone,
    clientCompletedCount: completedCount,
  };
}

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
    return Promise.all(rows.map((r) => attachClient(ctx, r)));
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
    return Promise.all(rows.map((r) => attachClient(ctx, r)));
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
    const trip = all.find((b) =>
      ["on_the_way", "arrived", "in_progress"].includes(b.status),
    );
    return trip ? await attachClient(ctx, trip) : null;
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
    return Promise.all(lined.map((r) => attachClient(ctx, r)));
  },
});

export const queueDepth = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("bookings").collect();
    return all.filter((b) => b.status === "queued").length;
  },
});

// ---------- reports ----------

/**
 * Aggregate totals for the bookings that fall in a date range.
 * Trip time = scheduledFor if present, else _creationTime.
 * Used for the admin "today / this week / this month" tiles.
 */
export const summaryForRange = query({
  args: { startMs: v.number(), endMs: v.number() },
  handler: async (ctx, { startMs, endMs }) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("bookings").collect();
    const inRange = all.filter((b) => {
      const t = b.scheduledFor ?? b._creationTime;
      return t >= startMs && t < endMs;
    });
    let count = 0;
    let revenue = 0;
    let completed = 0;
    let cancelled = 0;
    let pending = 0;
    for (const b of inRange) {
      count++;
      if (b.status === "completed") {
        completed++;
        revenue += b.price;
      } else if (["cancelled", "declined", "no_show"].includes(b.status)) {
        cancelled++;
      } else {
        pending++;
      }
    }
    return { count, revenue, completed, cancelled, pending };
  },
});

/**
 * Detailed list of trips in a date range, with passenger info attached.
 * Sorted newest first. Used for the admin "Reports" trip list.
 */
export const listForRange = query({
  args: { startMs: v.number(), endMs: v.number() },
  handler: async (ctx, { startMs, endMs }) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("bookings").collect();
    const inRange = all.filter((b) => {
      const t = b.scheduledFor ?? b._creationTime;
      return t >= startMs && t < endMs;
    });
    inRange.sort((a, b) => {
      const ta = a.scheduledFor ?? a._creationTime;
      const tb = b.scheduledFor ?? b._creationTime;
      return tb - ta;
    });
    return Promise.all(inRange.map((r) => attachClient(ctx, r)));
  },
});

/**
 * One row per client who has ever booked. Aggregates trip counts and
 * spend so admin can see who the regulars are, sort by frequency, and
 * call/text them directly. Sorted by total trips descending.
 */
export const clientsSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("bookings").collect();

    // Group bookings by clientUserId in a single pass.
    type Agg = {
      userId: Doc<"users">["_id"];
      totalTrips: number;
      completedTrips: number;
      cancelledTrips: number;
      totalSpent: number;
      lastTripAt: number;
    };
    const byClient = new Map<string, Agg>();
    for (const b of all) {
      const key = b.clientUserId as unknown as string;
      const agg = byClient.get(key) ?? {
        userId: b.clientUserId,
        totalTrips: 0,
        completedTrips: 0,
        cancelledTrips: 0,
        totalSpent: 0,
        lastTripAt: 0,
      };
      agg.totalTrips++;
      if (b.status === "completed") {
        agg.completedTrips++;
        agg.totalSpent += b.price;
      } else if (["cancelled", "declined", "no_show"].includes(b.status)) {
        agg.cancelledTrips++;
      }
      const t = b.scheduledFor ?? b._creationTime;
      if (t > agg.lastTripAt) agg.lastTripAt = t;
      byClient.set(key, agg);
    }

    // Resolve user records in parallel so we get name + phone for each row.
    const rows = await Promise.all(
      Array.from(byClient.values()).map(async (agg) => {
        const u = await ctx.db.get(agg.userId);
        return {
          ...agg,
          name: u?.name,
          phone: u?.phone,
        };
      }),
    );
    rows.sort((a, b) => b.totalTrips - a.totalTrips);
    return rows;
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

    // ----- Working-hours + blackout enforcement -----
    // The driver/settings page promises clients can only book during work
    // hours and outside blackouts. Enforce that here instead of trusting
    // the client UI to do it.
    const config = await ctx.db.query("driverConfig").first();
    if (config) {
      const tripTime = args.scheduledFor ?? Date.now();

      // ASAP only: if Collis has flipped to "off" manually, block.
      if (!args.scheduledFor && config.availability === "off") {
        throw new Error(
          "Collis is off right now. Tap Schedule to book for later.",
        );
      }

      if (!isWithinWorkingHours(tripTime, config)) {
        throw new Error(
          args.scheduledFor
            ? `That time is outside Collis's working hours (${config.workHoursStart}–${config.workHoursEnd}).`
            : `Collis is outside working hours right now (${config.workHoursStart}–${config.workHoursEnd}). Tap Schedule to book for later.`,
        );
      }

      const blackouts = await ctx.db.query("driverBlackouts").collect();
      const hit = blackoutCovering(tripTime, blackouts);
      if (hit) {
        const reason = hit.label ? ` (${hit.label})` : "";
        throw new Error(
          args.scheduledFor
            ? `That time is blocked off${reason}. Please pick a different time.`
            : `Collis is unavailable right now${reason}. Tap Schedule to book for later.`,
        );
      }
    }

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

/**
 * Public read of the driver's "right now" availability — used by the
 * client StatusBanner so it can surface things like "outside hours",
 * "blocked until 2pm", "day off" instead of just availability flag.
 * Computed server-side so the client doesn't need to know the rules.
 */
export const availabilityNow = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("driverConfig").first();
    if (!config) return { state: "unconfigured" as const };
    if (config.availability === "off")
      return { state: "off" as const, until: "today" as const };
    const now = Date.now();
    if (!isWithinWorkingHours(now, config)) {
      return {
        state: "outside_hours" as const,
        start: config.workHoursStart,
        end: config.workHoursEnd,
      };
    }
    const blackouts = await ctx.db.query("driverBlackouts").collect();
    const hit = blackoutCovering(now, blackouts);
    if (hit) {
      return {
        state: "blackout" as const,
        label: hit.label,
        endAt: hit.endAt,
      };
    }
    return { state: "available" as const };
  },
});

/**
 * Driver marks cash collected on a booking. Independent of status so
 * Collis can mark a completed trip paid the next day if he didn't get
 * the cash at dropoff.
 */
export const markPaid = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    await ctx.db.patch(id, { paidAt: Date.now() });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: "Marked paid",
    });
  },
});

export const markUnpaid = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    await ctx.db.patch(id, { paidAt: undefined });
    await ctx.db.insert("bookingEvents", {
      bookingId: id,
      label: "Unmarked paid",
    });
  },
});

// ---------- background jobs ----------

/**
 * Auto-decline ASAP requests Collis didn't respond to within 30 minutes.
 * Without this, missed bookings sit on the dashboard forever and pollute
 * the queue logic. Scheduled rides are left alone — they're meant to
 * wait until their pickup time.
 *
 * Wired in convex/crons.ts to run every 5 minutes.
 */
export const expireStaleRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
    const reqs = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "requested"))
      .collect();
    let expired = 0;
    for (const b of reqs) {
      // Only ASAP rows expire. Scheduled rides wait until their time.
      if (b.scheduledFor !== undefined) continue;
      if (b._creationTime >= cutoff) continue;
      await ctx.db.patch(b._id, { status: "declined" });
      await ctx.db.insert("bookingEvents", {
        bookingId: b._id,
        label: "Auto-expired (no response in 30 min)",
      });
      expired++;
    }
    return { expired };
  },
});

// ---------- availability helpers ----------

/**
 * True if the given timestamp falls on one of Collis's working days AND
 * within his configured start–end window. Days are 0=Sun..6=Sat to match
 * JS Date.getDay() and the settings UI.
 */
function isWithinWorkingHours(
  ts: number,
  config: Doc<"driverConfig">,
): boolean {
  const d = new Date(ts);
  if (!config.workDays.includes(d.getDay())) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const [sh, sm] = config.workHoursStart.split(":").map(Number);
  const [eh, em] = config.workHoursEnd.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return minutes >= startMin && minutes < endMin;
}

/**
 * Returns the first blackout that contains the given timestamp, or null.
 * Used for both UI status and the create-booking guard.
 */
function blackoutCovering(
  ts: number,
  blackouts: Doc<"driverBlackouts">[],
): Doc<"driverBlackouts"> | null {
  for (const b of blackouts) {
    if (ts >= b.startAt && ts < b.endAt) return b;
  }
  return null;
}

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

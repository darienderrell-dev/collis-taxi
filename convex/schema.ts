import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const bookingStatus = v.union(
  v.literal("requested"),
  v.literal("accepted"),
  v.literal("queued"),
  v.literal("on_the_way"),
  v.literal("arrived"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
  v.literal("no_show"),
);

export default defineSchema({
  // ----- Convex Auth tables, with `users` extended for our profile fields -----
  ...authTables,
  users: defineTable({
    // From Convex Auth's default users table:
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    // Our additions:
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(
      v.union(v.literal("client"), v.literal("driver"), v.literal("admin")),
    ),
    // Up to 3 favorite places for one-tap booking.
    favorites: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(), // e.g. "Home", "Market"
          zoneName: v.string(),
          detail: v.optional(v.string()),
        }),
      ),
    ),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // ----- App tables -----
  zones: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  prices: defineTable({
    // Always store lower id first (handled in mutations)
    zoneAId: v.id("zones"),
    zoneBId: v.id("zones"),
    price: v.number(), // whole G$
  }).index("by_pair", ["zoneAId", "zoneBId"]),

  driverConfig: defineTable({
    availability: v.union(
      v.literal("working"),
      v.literal("off"),
      v.literal("on_job"),
    ),
    workDays: v.array(v.number()),
    workHoursStart: v.string(), // "HH:MM"
    workHoursEnd: v.string(),
    slotMinutes: v.number(),
    driverName: v.string(),
    driverPhone: v.optional(v.string()),
    // Legacy pasted-URL field, kept for backward compatibility.
    driverPhotoUrl: v.optional(v.string()),
    // New: uploaded photo via Convex storage. driverConfig.get resolves
    // this to a URL when present, falling back to driverPhotoUrl.
    driverPhotoStorageId: v.optional(v.id("_storage")),
    vehicle: v.optional(v.string()),
    plate: v.optional(v.string()),
  }),

  driverBlackouts: defineTable({
    startAt: v.number(),
    endAt: v.number(),
    label: v.optional(v.string()),
  }),

  bookings: defineTable({
    clientUserId: v.id("users"),
    pickupZone: v.string(),
    pickupDetail: v.optional(v.string()),
    dropoffZone: v.string(),
    dropoffDetail: v.optional(v.string()),
    scheduledFor: v.optional(v.number()), // ms epoch; undefined = ASAP
    notes: v.optional(v.string()),
    status: bookingStatus,
    price: v.number(),
    // Cash collected: timestamp Collis tapped "Mark paid", undefined = unpaid.
    // Separate from status so we can mark a completed trip paid later
    // (he sometimes gets paid the next day).
    paidAt: v.optional(v.number()),
  })
    .index("by_client", ["clientUserId"])
    .index("by_status", ["status"])
    .index("by_scheduled", ["scheduledFor"]),

  bookingEvents: defineTable({
    bookingId: v.id("bookings"),
    label: v.string(),
  }).index("by_booking", ["bookingId"]),
});

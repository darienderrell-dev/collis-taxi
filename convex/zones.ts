import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./users";

// ---------- queries ----------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const zones = await ctx.db.query("zones").collect();
    zones.sort((a, b) => a.name.localeCompare(b.name));
    return zones;
  },
});

/**
 * Looks up the price (whole G$) between two zones. Returns null if not set.
 */
export const priceBetween = query({
  args: { zoneAId: v.id("zones"), zoneBId: v.id("zones") },
  handler: async (ctx, { zoneAId, zoneBId }) => {
    const [lo, hi] = (zoneAId as unknown as string) <
    (zoneBId as unknown as string)
      ? [zoneAId, zoneBId]
      : [zoneBId, zoneAId];
    const row = await ctx.db
      .query("prices")
      .withIndex("by_pair", (q) => q.eq("zoneAId", lo).eq("zoneBId", hi))
      .first();
    return row?.price ?? null;
  },
});

/**
 * Full price matrix for the admin editor. Returns:
 *   { zones: Doc<"zones">[], prices: { "<zoneA_zoneB>": number } }
 * Key is "lowId|hiId" so the client can look up any pair quickly.
 */
export const matrix = query({
  args: {},
  handler: async (ctx) => {
    const zones = await ctx.db.query("zones").collect();
    zones.sort((a, b) => a.name.localeCompare(b.name));
    const all = await ctx.db.query("prices").collect();
    const prices: Record<string, number> = {};
    for (const p of all) {
      prices[`${p.zoneAId}|${p.zoneBId}`] = p.price;
    }
    return { zones, prices };
  },
});

// ---------- mutations (admin only) ----------

export const createZone = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await requireStaff(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Zone name can't be empty");

    const existing = await ctx.db
      .query("zones")
      .withIndex("by_name", (q) => q.eq("name", trimmed))
      .first();
    if (existing) throw new Error("Zone already exists");

    const newZoneId = await ctx.db.insert("zones", { name: trimmed });

    // Seed prices with every existing zone (and self): default G$1,000 cross / G$500 same.
    const allZones = await ctx.db.query("zones").collect();
    for (const z of allZones) {
      const a = newZoneId;
      const b = z._id;
      const [lo, hi] =
        (a as unknown as string) < (b as unknown as string) ? [a, b] : [b, a];
      const existingPrice = await ctx.db
        .query("prices")
        .withIndex("by_pair", (q) => q.eq("zoneAId", lo).eq("zoneBId", hi))
        .first();
      if (!existingPrice) {
        await ctx.db.insert("prices", {
          zoneAId: lo,
          zoneBId: hi,
          price: a === b ? 500 : 1000,
        });
      }
    }
    return newZoneId;
  },
});

export const removeZone = mutation({
  args: { id: v.id("zones") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    // Cascade delete all price rows mentioning this zone.
    const all = await ctx.db.query("prices").collect();
    for (const p of all) {
      if (p.zoneAId === id || p.zoneBId === id) {
        await ctx.db.delete(p._id);
      }
    }
    await ctx.db.delete(id);
  },
});

export const setPrice = mutation({
  args: {
    zoneAId: v.id("zones"),
    zoneBId: v.id("zones"),
    price: v.number(),
  },
  handler: async (ctx, { zoneAId, zoneBId, price }) => {
    await requireStaff(ctx);
    if (price < 0) throw new Error("Price must be non-negative");

    const [lo, hi] = (zoneAId as unknown as string) <
    (zoneBId as unknown as string)
      ? [zoneAId, zoneBId]
      : [zoneBId, zoneAId];

    const existing = await ctx.db
      .query("prices")
      .withIndex("by_pair", (q) => q.eq("zoneAId", lo).eq("zoneBId", hi))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { price });
    } else {
      await ctx.db.insert("prices", { zoneAId: lo, zoneBId: hi, price });
    }
  },
});

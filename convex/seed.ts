import { internalMutation } from "./_generated/server";

const DEFAULT_ZONES = [
  "Mackenzie Market",
  "Mackenzie Hospital",
  "Wismar Bridge",
  "Linden Bus Park",
  "Republic Avenue",
  "Amelia's Ward",
  "Half Mile",
  "One Mile",
  "Silvertown",
  "Christianburg",
  "Linmine",
  "Watooka",
  "Bayrock",
];
const SAME_ZONE_PRICE = 500;
const CROSS_ZONE_PRICE = 1000;

/**
 * Seeds default zones + price matrix + the singleton driverConfig row.
 * Safe to call multiple times — only inserts rows that don't already exist.
 *
 * Run from the Convex dashboard (Functions → seed:run → Run) or via the CLI:
 *   npx convex run seed:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Zones
    for (const name of DEFAULT_ZONES) {
      const existing = await ctx.db
        .query("zones")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (!existing) await ctx.db.insert("zones", { name });
    }
    const zones = await ctx.db.query("zones").collect();

    // 2. Prices for every pair (sorted-id key)
    for (let i = 0; i < zones.length; i++) {
      for (let j = i; j < zones.length; j++) {
        const a = zones[i]._id;
        const b = zones[j]._id;
        const [lo, hi] =
          (a as unknown as string) < (b as unknown as string) ? [a, b] : [b, a];
        const existing = await ctx.db
          .query("prices")
          .withIndex("by_pair", (q) =>
            q.eq("zoneAId", lo).eq("zoneBId", hi),
          )
          .first();
        if (!existing) {
          await ctx.db.insert("prices", {
            zoneAId: lo,
            zoneBId: hi,
            price: i === j ? SAME_ZONE_PRICE : CROSS_ZONE_PRICE,
          });
        }
      }
    }

    // 3. Driver config (singleton)
    const config = await ctx.db.query("driverConfig").first();
    if (!config) {
      await ctx.db.insert("driverConfig", {
        availability: "working",
        workDays: [1, 2, 3, 4, 5, 6],
        workHoursStart: "06:00",
        workHoursEnd: "22:00",
        slotMinutes: 30,
        driverName: "Collis",
      });
    }

    return {
      zones: zones.length,
      pricesPairs: (zones.length * (zones.length + 1)) / 2,
      driverConfigCreated: !config,
    };
  },
});

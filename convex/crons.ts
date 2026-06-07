import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs. Convex runs these on the dev/prod deployment without
 * any external infra — no Vercel cron, no external scheduler.
 */
const crons = cronJobs();

// Every 5 minutes, sweep ASAP requests older than 30 min and decline them
// so they stop cluttering the driver dashboard.
crons.interval(
  "expire stale requests",
  { minutes: 5 },
  internal.bookings.expireStaleRequests,
);

// Daily at 04:30 UTC (~00:30 local Guyana time): walk active recurring
// series and create bookings for the next 14 days of occurrences.
// Idempotent — running this more often is safe, but daily is enough for
// a 14-day lookahead window.
crons.daily(
  "materialize recurring series",
  { hourUTC: 4, minuteUTC: 30 },
  internal.recurring.materializeRecurringSeries,
);

export default crons;

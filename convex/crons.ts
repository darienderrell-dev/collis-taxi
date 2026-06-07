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

export default crons;

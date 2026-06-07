import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Trace 10% of requests in production. Free tier is generous; we can dial up later.
  tracesSampleRate: 0.1,
  // No session replays by default (saves quota); record on errors.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // Adds breadcrumbs for fetch + console
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
});

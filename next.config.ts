import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  // Sentry org + project for sourcemap uploads (Vercel-side).
  org: "darien-keifer-derrell",
  project: "collis-taxi",
  // Quiet build output unless on CI.
  silent: !process.env.CI,
  // Upload sourcemaps for client + server.
  widenClientFileUpload: true,
  // Don't expose sourcemaps to end users.
  hideSourceMaps: true,
  disableLogger: true,
});

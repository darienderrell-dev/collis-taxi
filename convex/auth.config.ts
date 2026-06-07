// Convex Auth's JWKS configuration — required for verifying session JWTs.
// CONVEX_SITE_URL is set automatically by `npx convex dev`.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

/*
 * Collis Taxi service worker.
 *
 * Minimum viable shape: install + activate + fetch handlers. The fetch
 * handler is what Chrome on Android specifically looks for when
 * deciding whether the page is installable (beforeinstallprompt won't
 * fire without a service worker that handles fetch).
 *
 * Caching strategy: network-first, fall back to cache. We don't try to
 * be clever about offline — the app needs Convex to be useful — but
 * caching the shell means a flaky connection can still load the UI.
 *
 * Update strategy: skipWaiting + clients.claim so a new deploy takes
 * effect on the next page load without forcing the user through an
 * "update available" dance.
 */

const CACHE_NAME = "collis-taxi-v1";

self.addEventListener("install", (event) => {
  // Take over immediately on first install.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(["/", "/manifest.json", "/icon.svg"]).catch(() => {
          // Best-effort precache — silently ignore failures so install
          // doesn't get stuck on a 404 for a renamed asset.
        }),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nuke stale caches from prior versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only intercept GET requests. POST/PUT/etc. hit the network unmodified.
  if (req.method !== "GET") return;

  // Skip cross-origin requests (Convex, Sentry, etc.) — they manage their
  // own retries/transports and we don't want to cache their responses.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // CRITICAL: skip Next.js fingerprinted assets. Next.js rotates chunk
  // filenames on every deploy. If we cache /_next/static/chunks/abc.js
  // and the HTML now references xyz.js, the SW would either serve the
  // wrong file or 404 the new one. The browser cache and Next.js own
  // immutable headers handle these correctly without our help.
  if (url.pathname.startsWith("/_next/")) return;
  // Source maps too — same reason.
  if (url.pathname.endsWith(".map")) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Cache successful basic GETs from same-origin for offline fallback.
        if (fresh && fresh.ok && fresh.type === "basic") {
          const copy = fresh.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last resort: return the cached shell so the app at least loads.
        const shell = await caches.match("/");
        return shell ?? Response.error();
      }
    })(),
  );
});

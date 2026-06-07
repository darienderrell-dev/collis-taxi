"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js on first render. Renders nothing.
 *
 * The service worker exists primarily so Chrome on Android fires the
 * beforeinstallprompt event (its installability check requires a SW
 * that handles fetch). We don't lean on it for offline UX yet.
 *
 * Registration is best-effort: any error is silently swallowed because
 * a broken SW shouldn't break the app for the user.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Defer to load so we don't compete with the initial render.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration is best-effort; failure shouldn't surface.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}

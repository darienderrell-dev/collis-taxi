"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Persistent "Add to Home Screen" button.
 *
 * Behavior:
 * - Hidden once the app is already installed (display-mode: standalone).
 * - On Chrome/Android/Edge: captures `beforeinstallprompt` and triggers the
 *   native install dialog on tap.
 * - On iOS Safari: no programmatic install API exists. Tap shows a small
 *   bottom-sheet with the Share → Add to Home Screen steps.
 * - Always re-appears after a sign-out / page refresh — no permanent dismiss
 *   (user said the button must stay live until installed).
 */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // iOS detection — Safari doesn't fire beforeinstallprompt, only it can install.
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    // Already installed? (Standalone display mode.)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari legacy property
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setIsInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already installed, or running inside the installed PWA shell — nothing to do.
  if (isInstalled) return null;

  // Neither path available (e.g. desktop Firefox, old browser): hide rather
  // than show a button that does nothing.
  if (!deferred && !isIOS) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "accepted") setIsInstalled(true);
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 font-semibold rounded-full px-4 py-2 text-xs shadow-lg shadow-amber-900/40 hover:brightness-110"
      >
        📲 Add to home screen
      </button>

      {showIOSHelp && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end justify-center p-4 z-50"
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-1">
              Add Collis Taxi to your iPhone
            </div>
            <div className="text-xs text-slate-400 mb-4">
              Apple doesn&apos;t let websites install themselves — but it&apos;s
              three taps in Safari.
            </div>
            <ol className="text-sm text-slate-200 space-y-2 list-decimal pl-5">
              <li>
                Tap the <strong>Share</strong> icon{" "}
                <span aria-hidden>⬆️</span> at the bottom of Safari.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in the top-right.
              </li>
            </ol>
            <button
              onClick={() => setShowIOSHelp(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

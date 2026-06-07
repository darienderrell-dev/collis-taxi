"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Persistent "Add to Home Screen" button.
 *
 * - Hidden once the app is already installed (display-mode: standalone).
 * - On Chrome/Android/Edge: tap → captures `beforeinstallprompt` and triggers
 *   the native install dialog.
 * - On iOS Safari: Apple won't expose an install API. Tap shows a heavily
 *   visual instruction sheet with a bouncing arrow pointing at the Share
 *   button in Safari's bottom toolbar, plus inline SVG icons that match
 *   what the user will see in iOS.
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
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
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

  if (isInstalled) return null;
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
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 font-semibold rounded-full px-5 py-2.5 text-sm shadow-xl shadow-amber-900/50 hover:brightness-110 flex items-center gap-2"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <span aria-hidden>📲</span> Add to home screen
      </button>

      {showIOSHelp && (
        <IOSInstallSheet onClose={() => setShowIOSHelp(false)} />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// iOS Install — heavily visual, designed for older non-technical users.
// ----------------------------------------------------------------
function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col z-50"
      onClick={onClose}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-4xl mb-4">
          🚕
        </div>
        <div className="text-2xl font-bold text-slate-100">
          Save Collis Taxi
        </div>
        <div className="text-sm text-slate-400 mt-1 mb-8">
          to your iPhone home screen
        </div>

        <ol className="w-full max-w-sm space-y-4">
          <Step
            n={1}
            text={
              <>
                Tap the <strong>Share</strong> button below
              </>
            }
            icon={<ShareIcon />}
          />
          <Step
            n={2}
            text={
              <>
                Scroll and tap <strong>Add to Home Screen</strong>
              </>
            }
            icon={<AddToHomeIcon />}
          />
          <Step
            n={3}
            text={
              <>
                Tap <strong>Add</strong> in the top corner
              </>
            }
            icon={
              <div className="px-3 py-1 rounded-md bg-amber-500 text-slate-950 text-xs font-bold">
                Add
              </div>
            }
          />
        </ol>

        <button
          onClick={onClose}
          className="mt-10 px-8 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium"
        >
          Close
        </button>
      </div>

      {/* Bouncing arrow at the bottom — points at Safari's Share button */}
      <div
        className="flex flex-col items-center pb-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="text-amber-300 text-xs uppercase tracking-wider font-semibold mb-1"
          style={{ animation: "ct-bounce 1.2s ease-in-out infinite" }}
        >
          Tap this share button
        </div>
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-300"
          style={{ animation: "ct-bounce 1.2s ease-in-out infinite" }}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>

      {/* Bounce keyframes — injected inline so we don't need a global CSS change */}
      <style>{`
        @keyframes ct-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(8px); }
        }
      `}</style>
    </div>
  );
}

function Step({
  n,
  text,
  icon,
}: {
  n: number;
  text: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 text-left bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-base shrink-0">
        {n}
      </div>
      <div className="flex-1 text-sm text-slate-200 leading-snug">{text}</div>
      <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sky-300">
        {icon}
      </div>
    </li>
  );
}

// Apple's Share icon (square with arrow pointing out the top).
function ShareIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <polyline points="7 8 12 3 17 8" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

// Apple's "Add to Home Screen" icon (square with plus).
function AddToHomeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

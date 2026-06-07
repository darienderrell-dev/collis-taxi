"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Persistent "Add to Home Screen" button + iOS install guide.
 *
 * iOS guide approach (after user feedback): the previous version with a
 * bouncing arrow + 3 text steps still required hunting for the Share button
 * on the real Safari toolbar. New version embeds an animated mini-iPhone
 * diagram inside the modal, with the Share icon pulsing and labeled, so the
 * user can match the picture to their real phone without confusion.
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

      {showIOSHelp && <IOSInstallSheet onClose={() => setShowIOSHelp(false)} />}
    </>
  );
}

// ----------------------------------------------------------------
// iOS Install Sheet — visual mini-iPhone, no hunting required.
// ----------------------------------------------------------------
function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center px-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-xl font-bold">Save Collis Taxi to your iPhone</div>
          <div className="text-xs text-slate-400 mt-1">
            Two taps. Here&apos;s exactly where to find the button.
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <PhoneMockup />
        </div>

        <ol className="mt-4 space-y-2 text-sm text-slate-200">
          <li className="flex items-start gap-3 bg-slate-800/60 rounded-xl p-3">
            <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shrink-0">
              1
            </span>
            <span>
              On your real Safari, tap the <strong>Share</strong> button — the
              same little icon glowing yellow above.
            </span>
          </li>
          <li className="flex items-start gap-3 bg-slate-800/60 rounded-xl p-3">
            <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shrink-0">
              2
            </span>
            <span>
              Scroll down in the menu and tap{" "}
              <strong>Add to Home Screen</strong>, then{" "}
              <strong>Add</strong>.
            </span>
          </li>
        </ol>

        <div className="mt-3 text-[11px] text-slate-500 text-center">
          Don&apos;t see the bottom bar? Tap your address bar once — Safari
          hides the toolbar while scrolling.
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-semibold"
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes ct-pulse {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.5); opacity: 0.4; }
        }
        @keyframes ct-tap {
          0%, 70%, 100% { transform: scale(1); }
          80%           { transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

/**
 * Mini-iPhone SVG. Shows Safari's bottom toolbar with the Share button
 * highlighted by a pulsing yellow ring and a labeled arrow.
 */
function PhoneMockup() {
  return (
    <svg
      viewBox="0 0 220 360"
      className="w-44 h-72"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Phone body */}
      <rect
        x="4"
        y="4"
        width="212"
        height="352"
        rx="28"
        fill="#1f2937"
        stroke="#475569"
        strokeWidth="2"
      />
      {/* Screen */}
      <rect x="12" y="12" width="196" height="336" rx="20" fill="#0b0f17" />

      {/* Status bar */}
      <text
        x="30"
        y="30"
        fill="#cbd5e1"
        fontSize="11"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        fontWeight="600"
      >
        9:41
      </text>
      <circle cx="170" cy="26" r="3" fill="#cbd5e1" />
      <rect x="178" y="22" width="14" height="8" rx="2" fill="#cbd5e1" />

      {/* "Page content" placeholders */}
      <rect x="24" y="50" width="172" height="14" rx="3" fill="#1e293b" />
      <rect x="24" y="72" width="120" height="10" rx="3" fill="#1e293b" />
      <rect x="24" y="90" width="172" height="60" rx="6" fill="#1e293b" />
      <rect x="24" y="160" width="140" height="10" rx="3" fill="#1e293b" />
      <rect x="24" y="178" width="172" height="10" rx="3" fill="#1e293b" />
      <rect x="24" y="196" width="100" height="10" rx="3" fill="#1e293b" />

      {/* URL bar (address bar) above the toolbar */}
      <rect x="24" y="252" width="172" height="22" rx="11" fill="#1e293b" />
      <text x="110" y="266" textAnchor="middle" fill="#64748b" fontSize="9">
        collis-taxi.vercel.app
      </text>

      {/* Bottom toolbar */}
      <rect x="12" y="282" width="196" height="66" rx="0" fill="#1f2937" />

      {/* Toolbar icons: back, forward, SHARE (highlighted), bookmark, tabs */}
      {/* Back */}
      <g
        transform="translate(36 312)"
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6,0 -2,8 6,16" />
      </g>
      {/* Forward */}
      <g
        transform="translate(72 312)"
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="-2,0 6,8 -2,16" />
      </g>

      {/* Pulsing ring under the share button */}
      <circle
        cx="110"
        cy="320"
        r="16"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        style={{ animation: "ct-pulse 1.4s ease-in-out infinite", transformOrigin: "110px 320px" }}
      />

      {/* Share icon (square with up-arrow) */}
      <g
        transform="translate(110 320)"
        style={{ animation: "ct-tap 1.6s ease-in-out infinite", transformOrigin: "110px 320px" }}
      >
        <g
          transform="translate(-9 -10)"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 1v12" />
          <polyline points="5,5 9,1 13,5" />
          <path d="M3 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7" />
        </g>
      </g>

      {/* Bookmark */}
      <g
        transform="translate(146 311)"
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 0v18l5-4 5 4V0z" />
      </g>
      {/* Tabs */}
      <g
        transform="translate(180 311)"
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="0" y="0" width="13" height="18" rx="2" />
        <rect x="-4" y="-4" width="13" height="18" rx="2" />
      </g>

      {/* "Tap here" callout */}
      <g>
        <line
          x1="110"
          y1="240"
          x2="110"
          y2="298"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
        <polygon points="106,294 114,294 110,302" fill="#fbbf24" />
        <rect x="58" y="218" width="104" height="22" rx="11" fill="#fbbf24" />
        <text
          x="110"
          y="233"
          textAnchor="middle"
          fill="#0b0f17"
          fontSize="11"
          fontWeight="700"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          TAP THIS BUTTON
        </text>
      </g>
    </svg>
  );
}

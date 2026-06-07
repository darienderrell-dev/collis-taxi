import type { Metadata, Viewport } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/lib/convex/provider";
import { InstallButton } from "@/components/InstallButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collis Taxi",
  description: "Linden's local taxi — book a ride with Collis",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className="bg-slate-950 text-slate-100 min-h-screen antialiased"
          suppressHydrationWarning
        >
          <ConvexClientProvider>
            {/* Visual cover for the iOS status-bar area — see globals.css.
                Keeps clock/signal legible while content scrolls under. */}
            <div className="status-bar-shim" aria-hidden />
            {children}
            <InstallButton />
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}

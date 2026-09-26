import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontDisplay, fontSans } from "@/lib/fonts";
import { siteUrl } from "@/lib/env";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/client/boot";
import { AnalyticsClient } from "@/components/app/AnalyticsClient";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Vary Board App", template: "%s · Vary Board App" },
  description: "The companion app for the Vary Board wall-mounted training board: follow the movements your physical therapist chose, one at a time.",
  applicationName: "Vary Board",
  appleWebApp: { capable: true, title: "Vary Board", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    siteName: "The Vary Board",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vary Board App: a honeycomb of mint hexagons filling in, one per session" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  // Every screen is noindex unless it opts in (only the /app landing does).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays allowed on purpose.
  viewportFit: "cover",
  themeColor: "#f1efea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontDisplay.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        {process.env.VERCEL && <AnalyticsClient />}
      </body>
    </html>
  );
}

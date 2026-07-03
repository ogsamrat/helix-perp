import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Fraunces } from "next/font/google";
import { Aurora } from "@/components/ui/aurora";
import { Grain } from "@/components/ui/grain";
import "./globals.css";
import { Providers } from "./providers";

// Editorial display serif — used sparingly for headlines + hero numerals.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Helix — Perpetual Futures on Stellar",
  description:
    "Trade leveraged perpetuals on gold, FX and crypto, settled in on-chain USDC. A decentralized perp DEX built on Stellar / Soroban.",
  keywords: ["Stellar", "Soroban", "perpetuals", "DeFi", "RWA", "FX", "gold", "USDC"],
  openGraph: {
    title: "Helix — Perpetual Futures on Stellar",
    description: "Leveraged perps on real-world assets, settled on-chain in USDC.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans text-ink antialiased">
        <Aurora />
        <Grain />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

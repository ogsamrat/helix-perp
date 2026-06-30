import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

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

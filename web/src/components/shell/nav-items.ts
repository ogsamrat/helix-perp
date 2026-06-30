import {
  Activity,
  BarChart3,
  CandlestickChart,
  Layers,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/trade", label: "Trade", icon: CandlestickChart },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/vault", label: "Vault", icon: Layers },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

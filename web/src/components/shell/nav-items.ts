import {
  Activity,
  BarChart3,
  CandlestickChart,
  Layers,
  type LucideIcon,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trade",
    items: [
      { href: "/trade", label: "Trade", icon: CandlestickChart },
      { href: "/portfolio", label: "Portfolio", icon: Wallet },
      { href: "/vault", label: "Vault", icon: Layers },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

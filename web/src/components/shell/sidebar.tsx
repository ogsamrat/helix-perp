"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { CONFIG } from "@/config";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-hairline bg-surface/60 md:flex">
      <div className="flex h-14 items-center px-5">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-elevated text-ink" : "text-ink-faint hover:bg-elevated/60 hover:text-ink-muted",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-brand")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-hairline p-4">
        <div className="flex items-center gap-2 text-2xs text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-long" />
          Soroban · {CONFIG.network}
        </div>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-hairline bg-surface/95 backdrop-blur md:hidden">
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-2xs",
              active ? "text-brand" : "text-ink-faint",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

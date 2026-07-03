"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/shell/nav-items";
import { CONFIG } from "@/config";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface/40 md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.label && <p className="eyebrow px-3 pb-2 text-[0.625rem]">{group.label}</p>}
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-elevated text-ink shadow-soft"
                      : "text-ink-muted hover:bg-elevated/50 hover:text-ink",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
                  )}
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] transition-colors",
                      active ? "text-brand" : "text-ink-faint group-hover:text-ink-muted",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-3">
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5">
          <span className="text-2xs font-medium text-ink-muted">Network</span>
          <span className="flex items-center gap-1.5 text-2xs text-ink-faint">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-long" />
            {CONFIG.network}
          </span>
        </div>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-hairline md:hidden">
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-2xs transition-colors",
              active ? "text-brand" : "text-ink-faint",
            )}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { levelTitle } from "@/lib/gamification/level";
import { cn } from "@/lib/cn";
import { XPBadge } from "@/components/ui/xp-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "ホーム", icon: "home" },
  { href: "/lessons", label: "レッスン", icon: "book" },
  { href: "/progress", label: "進捗", icon: "trending" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const profile = state.profile;

  return (
    <div className="min-h-full">
      <header className="glass sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl brand-gradient text-white shadow-[var(--shadow-glow)]">
              話
            </span>
            <span className="hidden text-lg sm:inline text-gradient">Shadow IT JP</span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-all",
                    active
                      ? "brand-gradient text-white font-semibold shadow-[var(--shadow-glow)]"
                      : "text-muted hover:text-fg hover:bg-surface/70",
                  )}
                >
                  <Icon name={item.icon} size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {profile && (
              <>
                <span className="hidden md:inline">
                  <Badge tone="warning">
                    <Icon name="flame" size={13} filled />
                    {profile.current_streak}
                  </Badge>
                </span>
                <span className="hidden sm:inline">
                  <XPBadge xp={profile.total_xp} />
                </span>
                <div className="group relative">
                  <button
                    className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm focus-ring"
                    title={levelTitle(profile.current_level)}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full brand-gradient text-xs text-white">
                      {profile.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden lg:inline max-w-[10rem] truncate">
                      {profile.display_name}
                    </span>
                  </button>
                  <div className="invisible absolute right-0 mt-1 w-44 rounded-xl border border-border bg-card p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    <div className="px-3 py-2 text-xs text-muted">
                      Lv.{profile.current_level} · {levelTitle(profile.current_level)}
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        router.replace("/login");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface"
                    >
                      <Icon name="logout" size={15} />
                      ログアウト
                    </button>
                  </div>
                </div>
              </>
            )}
            {!profile && (
              <Link href="/login" className={buttonClasses("primary", "sm")}>
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

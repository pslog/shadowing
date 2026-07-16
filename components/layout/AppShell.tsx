"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { levelProgress, levelTitle } from "@/lib/gamification/level";
import { isAdminProfile } from "@/lib/store/selectors";
import { cn } from "@/lib/cn";
import { XPBadge } from "@/components/ui/xp-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";

type NavItem = { href: string; label: string; icon: IconName; alt?: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "ホーム", icon: "home" },
  { href: "/courses", label: "コース", icon: "book", alt: ["/lessons"] },
  { href: "/review", label: "単語帳", icon: "bookmark" },
  { href: "/progress", label: "進捗", icon: "trending" },
  { href: "/about", label: "紹介", icon: "sparkles" },
];

function useActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    (item.alt?.some((p) => pathname.startsWith(p)) ?? false);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const profile = state.profile;
  const profileLevel = profile ? levelProgress(profile.total_xp).level : 1;
  const canAdmin = isAdminProfile(profile);
  const navItems: NavItem[] = canAdmin
    ? [...NAV, { href: "/admin/users", label: "ユーザー管理", icon: "cap" }]
    : NAV;
  // Mobile bottom bar: keep only the core daily-use tabs so it never crowds.
  // 紹介 (static intro) and admin live in the desktop nav / footer only.
  const mobileNavItems = navItems.filter(
    (item) => item.href !== "/about" && item.href !== "/admin/users",
  );
  const isActive = useActive();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
      <header className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.png"
              alt="Shadowing JP"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <span className="hidden text-lg sm:inline text-gradient">Shadowing JP</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all",
                    active
                      ? "brand-gradient font-semibold text-white shadow-[var(--shadow-glow)]"
                      : "text-muted hover:bg-surface/70 hover:text-fg",
                  )}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {profile ? (
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
                <Link
                  href="/about"
                  aria-label="紹介"
                  className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-fg md:hidden"
                >
                  <Icon name="sparkles" size={18} />
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="focus-ring flex h-11 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm"
                    title={levelTitle(profileLevel)}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full brand-gradient text-xs text-white">
                      {profile.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[10rem] truncate lg:inline">
                      {profile.display_name}
                    </span>
                    <Icon name="chevron-right" size={14} className="rotate-90 text-muted" />
                  </button>
                  {menuOpen && (
                    <>
                      <button
                        aria-hidden
                        tabIndex={-1}
                        onClick={() => setMenuOpen(false)}
                        className="fixed inset-0 z-40 cursor-default"
                      />
                      <div
                        role="menu"
                        className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-lg"
                      >
                        <div className="px-3 py-2 text-xs text-muted">
                          <p className="truncate font-semibold text-fg">
                            {profile.display_name}
                          </p>
                          Lv.{profileLevel} · {levelTitle(profileLevel)}
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            router.replace("/login");
                          }}
                          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface"
                        >
                          <Icon name="logout" size={15} />
                          ログアウト
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/about"
                  className="text-sm font-semibold text-muted hover:text-fg md:hidden"
                >
                  紹介
                </Link>
                <Link href="/login" className={buttonClasses("primary", "sm")}>
                  ログイン
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      <footer className="mt-8 border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.png"
              alt="Shadowing JP"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <div>
              <p className="text-sm font-bold text-gradient">Shadowing JP</p>
              <p className="text-xs text-muted">Cùng cộng đồng luyện nói tiếng Nhật mỗi ngày</p>
            </div>
          </div>
          <p className="text-xs text-muted">Phi lợi nhuận · 一緒に頑張りましょう</p>
        </div>
        <div className="border-t border-border/50 px-4 py-3 text-center text-[11px] text-muted">
          © {new Date().getFullYear()} Shadowing JP
        </div>
      </footer>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch">
          {mobileNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon name={item.icon} size={22} filled={active} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
import { Avatar } from "@/components/ui/avatar";
import { stripLocale, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/useI18n";

type NavItem = {
  href: string;
  labelKey: "home" | "courses" | "review" | "progress" | "about" | "admin";
  icon: IconName;
  alt?: string[];
};

interface PublicSiteVisitOverview {
  totalVisits: number;
}

const SITE_VISIT_DISPLAY_BASELINE = 1000;
const SITE_VISIT_DEDUPE_MS = 2_000;
const COPYRIGHT_YEAR = 2026;
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const recentSiteVisitRecords = new Map<string, number>();

const NAV: NavItem[] = [
  { href: "/", labelKey: "home", icon: "home" },
  { href: "/courses", labelKey: "courses", icon: "book", alt: ["/lessons"] },
  { href: "/review", labelKey: "review", icon: "bookmark" },
  { href: "/progress", labelKey: "progress", icon: "trending" },
  { href: "/about", labelKey: "about", icon: "sparkles" },
];

function useActive() {
  const pathname = usePathname();
  const path = stripLocale(pathname || "/");
  return (item: NavItem) => {
    const itemPath = item.href === "/" ? "/" : item.href;
    return (
      path === itemPath ||
      (itemPath !== "/" && path.startsWith(itemPath + "/")) ||
      (item.alt?.some((p) => path === p || path.startsWith(p + "/")) ?? false)
    );
  };
}

function LanguageSwitch({
  locale,
  switchHref,
  labels,
}: {
  locale: Locale;
  switchHref: (locale: Locale) => string;
  labels: { label: string; viShort: string; jaShort: string; ja: string };
}) {
  return (
    <div
      role="group"
      aria-label={labels.label}
      className="flex items-center rounded-full border border-border bg-surface p-0.5 text-[11px] font-black"
    >
      {(["vi", "ja"] as Locale[]).map((item) => (
        <Link
          key={item}
          href={switchHref(item)}
          aria-current={locale === item ? "true" : undefined}
          className={cn(
            "rounded-full px-2 py-1 transition-colors sm:px-2.5",
            locale === item
              ? "brand-gradient text-white shadow-[var(--shadow-glow)]"
              : "text-muted hover:text-fg",
          )}
          hrefLang={item}
        >
          {item === "vi" ? (
            labels.viShort
          ) : (
            <>
              <span className="md:hidden">{labels.jaShort}</span>
              <span className="hidden md:inline">{labels.ja}</span>
            </>
          )}
        </Link>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const { locale, dictionary: m, href, switchHref } = useI18n();
  const profile = state.profile;
  const profileLevel = profile ? levelProgress(profile.total_xp).level : 1;
  const canAdmin = isAdminProfile(profile);
  const navItems: NavItem[] = canAdmin
    ? [
        ...NAV,
        { href: "/admin/users", labelKey: "admin", icon: "cap", alt: ["/admin"] },
      ]
    : NAV;
  // Mobile bottom bar: keep only the core daily-use tabs so it never crowds.
  // 紹介 (static intro) and admin live in the desktop nav / footer only.
  const mobileNavItems = navItems.filter(
    (item) => item.href !== "/about" && !item.href.startsWith("/admin"),
  );
  const isActive = useActive();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visitOverview, setVisitOverview] = useState<PublicSiteVisitOverview>({
    totalVisits: 0,
  });
  const displayTotalVisits = visitOverview.totalVisits + SITE_VISIT_DISPLAY_BASELINE;

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/site-visits", { cache: "no-store" })
      .then(async (response) => {
        const raw = await response.text();
        const payload = raw
          ? (JSON.parse(raw) as { overview?: Partial<PublicSiteVisitOverview> })
          : null;
        if (!response.ok || !payload?.overview) return null;
        return payload.overview;
      })
      .then((overview) => {
        if (cancelled || !overview) return;
        setVisitOverview({ totalVisits: overview.totalVisits ?? 0 });
      })
      .catch(() => {
        if (!cancelled) setVisitOverview({ totalVisits: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const lastRecordedAt = recentSiteVisitRecords.get(pathname) ?? 0;
    if (now - lastRecordedAt < SITE_VISIT_DEDUPE_MS) return;
    recentSiteVisitRecords.set(pathname, now);

    const storageKey = "shadowing-jp-visitor-id";
    let anonymousSessionId = window.sessionStorage.getItem(storageKey);
    if (!anonymousSessionId) {
      anonymousSessionId = crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, anonymousSessionId);
    }

    let cancelled = false;

    fetch("/api/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, anonymousSessionId }),
    })
      .then(() => fetch("/api/site-visits", { cache: "no-store" }))
      .then(async (response) => {
        const raw = await response.text();
        const payload = raw
          ? (JSON.parse(raw) as { overview?: Partial<PublicSiteVisitOverview> })
          : null;
        if (!response.ok || !payload?.overview) return null;
        return payload.overview;
      })
      .then((overview) => {
        if (cancelled || !overview) return;
        setVisitOverview({ totalVisits: overview.totalVisits ?? 0 });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
      <header className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href={href("/")} className="flex items-center gap-2.5 font-bold">
            <Image
              src="/logo-mark-256.webp"
              alt="Shadowing JP"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              quality={75}
            />
            <span className="hidden text-lg sm:inline text-gradient">Shadowing JP</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all",
                    active
                      ? "brand-gradient font-semibold text-white shadow-[var(--shadow-glow)]"
                      : "text-muted hover:bg-surface/70 hover:text-fg",
                  )}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{m.nav[item.labelKey]}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitch
              locale={locale}
              switchHref={switchHref}
              labels={m.language}
            />
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
                  href={href("/about")}
                  aria-label={m.nav.about}
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
                    title={levelTitle(profileLevel, locale)}
                  >
                    <Avatar
                      src={profile.avatar_url}
                      name={profile.display_name}
                      className="h-8 w-8 rounded-full text-xs"
                    />
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
                          Lv.{profileLevel} · {levelTitle(profileLevel, locale)}
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            router.replace(href("/login"));
                          }}
                          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface"
                        >
                          <Icon name="logout" size={15} />
                          {m.common.logout}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href={href("/about")}
                  className="text-sm font-semibold text-muted hover:text-fg md:hidden"
                >
                  {m.nav.about}
                </Link>
                <Link href={href("/login")} className={buttonClasses("primary", "sm")}>
                  {m.common.login}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      <footer className="mt-8 border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-mark-256.webp"
              alt="Shadowing JP"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              quality={75}
            />
            <div>
              <p className="text-sm font-bold text-gradient">Shadowing JP</p>
              <p className="text-xs text-muted">{m.footer.tagline}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <p className="text-xs text-muted">{m.footer.note}</p>
            <p
              className="text-xs text-muted tabular-nums"
              aria-label={`${displayTotalVisits} ${m.footer.visits}`}
            >
              {NUMBER_FORMAT.format(displayTotalVisits)} {m.footer.visits}
            </p>
          </div>
        </div>
        <div className="border-t border-border/50 px-4 py-3 text-center text-[11px] text-muted">
          © {COPYRIGHT_YEAR} Shadowing JP
        </div>
      </footer>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch">
          {mobileNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                className={cn(
                  "flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon name={item.icon} size={22} filled={active} />
                {m.nav[item.labelKey]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

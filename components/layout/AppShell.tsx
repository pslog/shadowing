"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { levelMascot, levelProgress, levelTitle } from "@/lib/gamification/level";
import { isAdminProfile } from "@/lib/store/selectors";
import { cn } from "@/lib/cn";
import { XPBadge } from "@/components/ui/xp-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { MascotBadge } from "@/components/ui/mascot";
import { MascotCompanion } from "@/components/companion/MascotCompanion";
import { stripLocale, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/useI18n";
import { getAnonymousSessionId } from "@/lib/anonymous-session";

type NavItem = {
  href: string;
  labelKey: "home" | "courses" | "review" | "progress";
  icon: IconName;
  alt?: string[];
};

interface PublicSiteVisitOverview {
  totalVisits: number;
}

const SITE_VISIT_DISPLAY_BASELINE = 1000;
const SITE_VISIT_DEDUPE_MS = 2_000;
const COPYRIGHT_YEAR = 2026;
/** Grace period so the pointer can cross the gap from the avatar to the menu. */
const MENU_CLOSE_DELAY_MS = 160;
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const recentSiteVisitRecords = new Map<string, number>();

// Daily-use destinations only, and few enough that the Vietnamese labels never
// wrap the bar. The static pages (about / terms / privacy) live in the footer.
const NAV: NavItem[] = [
  { href: "/", labelKey: "home", icon: "home" },
  { href: "/courses", labelKey: "courses", icon: "book", alt: ["/lessons"] },
  { href: "/review", labelKey: "review", icon: "bookmark" },
  { href: "/progress", labelKey: "progress", icon: "trending" },
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
  const profileMascot = levelMascot(profileLevel);
  const canAdmin = isAdminProfile(profile);
  // Admin is a rare, non-daily destination: it lives in the avatar menu only,
  // so the nav bar stays the same width for every user.
  const footerLinks = [
    { href: "/about", label: m.nav.about },
    { href: "/terms", label: m.footer.terms },
    { href: "/privacy", label: m.footer.privacy },
  ];
  const isActive = useActive();
  const [menuOpen, setMenuOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visitOverview, setVisitOverview] = useState<PublicSiteVisitOverview>({
    totalVisits: 0,
  });
  const displayTotalVisits = visitOverview.totalVisits + SITE_VISIT_DISPLAY_BASELINE;

  useEffect(() => setMenuOpen(false), [pathname]);

  // Hover-to-open only where hovering is real. On touch a tap fires mouseenter
  // too, which would open the menu and then immediately toggle it shut.
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current === null) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const openMenu = useCallback(() => {
    cancelClose();
    setMenuOpen(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMenuOpen(false), MENU_CLOSE_DELAY_MS);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      cancelClose();
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelClose();
      setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelClose, menuOpen]);

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

    const anonymousSessionId = getAnonymousSessionId();

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
            {NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-all",
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
                <div
                  ref={menuRef}
                  className="relative"
                  onMouseEnter={canHover ? openMenu : undefined}
                  onMouseLeave={canHover ? scheduleClose : undefined}
                >
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
                    // pt-1 instead of mt-1: the offset stays hoverable, so the
                    // pointer never leaves the wrapper on its way to the menu.
                    <div className="absolute right-0 top-full z-50 w-52 pt-1">
                      <div
                        role="menu"
                        className="rounded-xl border border-border bg-card p-1 shadow-lg"
                      >
                        <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted">
                          <MascotBadge
                            slug={profileMascot.slug}
                            accent={profileMascot.accent}
                            size={38}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-fg">
                              {profile.display_name}
                            </p>
                            <p className="truncate">
                              Lv.{profileLevel} · {levelTitle(profileLevel, locale)}
                            </p>
                          </div>
                        </div>
                        {canAdmin && (
                          <Link
                            href={href("/admin/users")}
                            role="menuitem"
                            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-fg"
                          >
                            <Icon name="cap" size={15} />
                            {m.nav.admin}
                          </Link>
                        )}
                        <button
                          role="menuitem"
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
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href={href("/login")} className={buttonClasses("primary", "sm")}>
                {m.common.login}
              </Link>
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
        <div className="border-t border-border/50">
          {/* Plain flex-col (not reverse): links come first in the DOM now, and
              on mobile that already stacks them above the copyright. */}
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-3 text-[11px] text-muted sm:flex-row sm:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-semibold">
              {footerLinks.map((item, index) => (
                <Fragment key={item.href}>
                  {index > 0 && (
                    <span aria-hidden className="text-muted/40">
                      ·
                    </span>
                  )}
                  <Link
                    href={href(item.href)}
                    className="transition-colors hover:text-fg"
                  >
                    {item.label}
                  </Link>
                </Fragment>
              ))}
            </div>
            <p>© {COPYRIGHT_YEAR} Shadowing JP</p>
          </div>
        </div>
      </footer>

      <MascotCompanion />

      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch">
          {NAV.map((item) => {
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

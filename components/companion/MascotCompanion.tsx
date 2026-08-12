"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { lessonById, lessonBySlug } from "@/lib/store/selectors";
import { levelMascot, levelProgress, levelTitle } from "@/lib/gamification/level";
import { nextCompanionAction, type CompanionAction } from "@/lib/gamification/companion";
import { stripLocale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/useI18n";
import { Mascot } from "@/components/ui/mascot";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

// Focused admin/auth screens, where "go practise" is not a useful thing to say.
// The lesson player is deliberately NOT here: that is where the companion has
// the most to report, and nothing in the player is fixed to this corner (only
// its mission dialog, which sits at z-60 and covers the companion anyway).
const HIDDEN_PREFIXES = ["/login", "/admin", "/upload", "/tool"];

/** Remembers which suggestion was already delivered, so it speaks once a day. */
const SEEN_KEY = "shadowing-jp-companion-seen";
const AUTO_COLLAPSE_MS = 9_000;

function isHidden(path: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** `/lessons/<slug-or-id>` -> that segment; anything else -> undefined. */
function lessonKeyFromPath(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "lessons" || parts.length !== 2) return undefined;
  return parts[1];
}

export function MascotCompanion() {
  const { state } = useData();
  const pathname = usePathname();
  const { locale, localeTag, dictionary: m, href } = useI18n();
  const t = m.companion;

  const path = stripLocale(pathname || "/");
  const hidden = isHidden(path);

  const lessonKey = lessonKeyFromPath(path);
  const action = useMemo(() => {
    const lesson = lessonKey
      ? lessonBySlug(state, lessonKey) ?? lessonById(state, lessonKey)
      : undefined;
    return nextCompanionAction(state, { lessonId: lesson?.id });
  }, [lessonKey, state]);
  const level = state.profile ? levelProgress(state.profile.total_xp).level : 1;
  const mascot = levelMascot(level);

  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Speak up when the advice actually changes (new day, or the state moved on),
  // and stay quiet on later page views that would repeat the same sentence.
  useEffect(() => {
    if (hidden) return;
    setMounted(true);

    // The lesson id is part of the stamp so opening a DIFFERENT lesson gets a
    // fresh greeting, while passing sentences inside one lesson does not reopen
    // the bubble on every attempt. It speaks at milestones, not continuously.
    const today = new Date().toISOString().slice(0, 10);
    const stamp = `${today}:${action.key}:${action.lessonId ?? ""}`;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(SEEN_KEY);
    } catch {
      // Private mode / storage disabled: fall through and just show it.
    }
    if (seen === stamp) return;

    setExpanded(true);
    try {
      window.localStorage.setItem(SEEN_KEY, stamp);
    } catch {
      // Non-fatal: worst case the bubble opens again next navigation.
    }
  }, [action.key, action.lessonId, hidden]);

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [expanded]);

  const toggle = useCallback(() => setExpanded((value) => !value), []);

  if (hidden || !mounted) return null;

  const { message, cta } = describe(action, t, {
    localeTag,
    nextMascotTitle: levelTitle((action.level ?? level) as number, locale),
  });

  return (
    <div
      className={cn(
        "fixed right-3 z-30 flex items-end gap-2 sm:right-5",
        // Clear the mobile bottom nav (h-16) plus the iOS home indicator.
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5",
      )}
    >
      {expanded && (
        <div
          role="status"
          className="animate-pop max-w-[15rem] rounded-2xl rounded-br-sm border border-border bg-card p-3 shadow-[var(--shadow-md)] sm:max-w-[17rem]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
              {levelTitle(level, locale)}
            </p>
            <button
              onClick={() => setExpanded(false)}
              aria-label={t.collapse}
              className="focus-ring -mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              <Icon name="plus" size={13} className="rotate-45" />
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-fg">{message}</p>
          <Link
            href={href(action.href)}
            onClick={() => setExpanded(false)}
            className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/16"
          >
            {cta}
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      )}

      <button
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={expanded ? t.collapse : `${t.label}: ${t.expand}`}
        title={t.label}
        className="focus-ring relative grid h-14 w-14 shrink-0 place-items-center rounded-full border border-border bg-card shadow-[var(--shadow-md)] transition-transform hover:-translate-y-0.5 active:scale-95 sm:h-16 sm:w-16"
        style={{
          background: `radial-gradient(circle at 50% 28%, color-mix(in srgb, ${mascot.accent} 26%, var(--card)), var(--card))`,
        }}
      >
        <Mascot slug={mascot.slug} size={44} className={expanded ? undefined : "animate-float"} />
        {!expanded && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary"
          />
        )}
      </button>
    </div>
  );
}

/** Maps the engine's decision onto localized copy. */
function describe(
  action: CompanionAction,
  t: ReturnType<typeof useI18n>["dictionary"]["companion"],
  ctx: { localeTag: string; nextMascotTitle: string },
): { message: string; cta: string } {
  switch (action.key) {
    case "guest":
      return { message: t.guest, cta: t.guestCta };
    case "firstLesson":
      return { message: t.firstLesson, cta: t.firstLessonCta };
    case "streakAtRisk":
      return {
        message: t.streakAtRisk(action.left ?? 0, action.streak ?? 0),
        cta: t.streakAtRiskCta,
      };
    case "lessonProgress":
      return {
        message: t.lessonProgress(action.passed ?? 0, action.total ?? 0),
        cta: t.lessonProgressCta,
      };
    case "lessonDone":
      return { message: t.lessonDone, cta: t.lessonDoneCta };
    case "missionLeft":
      return { message: t.missionLeft(action.left ?? 0), cta: t.missionLeftCta };
    case "nearLevelUp":
      return {
        message: t.nearLevelUp(
          (action.xp ?? 0).toLocaleString(ctx.localeTag),
          action.level ?? 0,
          ctx.nextMascotTitle,
        ),
        cta: t.nearLevelUpCta,
      };
    case "resumeLesson":
      return {
        message: t.resumeLesson(action.lessonTitle ?? ""),
        cta: t.resumeLessonCta,
      };
    case "reviewVocab":
      return { message: t.reviewVocab(action.words ?? 0), cta: t.reviewVocabCta };
    case "allDone":
      return { message: t.allDone, cta: t.allDoneCta };
  }
}

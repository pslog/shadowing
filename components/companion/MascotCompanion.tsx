"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { lessonById, lessonBySlug } from "@/lib/store/selectors";
import { levelMascot, levelProgress, levelTitle } from "@/lib/gamification/level";
import { nextCompanionAction, type CompanionAction } from "@/lib/gamification/companion";
import {
  onCompanionEvent,
  reactionFor,
  type CompanionReaction,
  type Mood,
} from "@/lib/gamification/companion-events";
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

/** No input at all for this long reads as "stuck", and the companion offers help. */
const IDLE_MS = 30_000;
/** ...but at most this often, so a slow reader is not nagged every half minute. */
const IDLE_COOLDOWN_MS = 4 * 60_000;
/** Small talk (praise for one sentence, encouragement) is rate limited to this. */
const CHATTER_GAP_MS = 25_000;

function isHidden(path: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** `/lessons/<slug-or-id>` -> that segment; anything else -> undefined. */
function lessonKeyFromPath(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "lessons" || parts.length !== 2) return undefined;
  return parts[1];
}

/** What the bubble is currently doing. Reactions outrank suggestions. */
type Bubble =
  | { kind: "suggestion"; idle: boolean }
  | { kind: "reaction"; reaction: CompanionReaction; text: string; nonce: number };

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

  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [mounted, setMounted] = useState(false);

  // Rotates the wording of repeatable lines so the tenth "nice one!" of a
  // session is not literally the same sentence as the first.
  const variant = useRef(0);
  // Timestamps that keep the companion from talking over itself.
  const lastChatter = useRef(0);
  const lastIdleNudge = useRef(0);
  const lastSpoke = useRef(0);

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

    setBubble((current) =>
      // Never talk over a celebration with a routine suggestion.
      current?.kind === "reaction" ? current : { kind: "suggestion", idle: false },
    );
    lastSpoke.current = Date.now();
    try {
      window.localStorage.setItem(SEEN_KEY, stamp);
    } catch {
      // Non-fatal: worst case the bubble opens again next navigation.
    }
  }, [action.key, action.lessonId, hidden]);

  // React to what the learner just did. This is the half that makes it feel
  // like company rather than a hint button: praise lands within a second of
  // the take that earned it.
  useEffect(() => {
    if (hidden) return;
    return onCompanionEvent((event) => {
      const reaction = reactionFor(event);
      if (!reaction) return;

      const now = Date.now();
      if (reaction.tier === "chatter") {
        if (now - lastChatter.current < CHATTER_GAP_MS) return;
        lastChatter.current = now;
      }
      lastSpoke.current = now;
      variant.current += 1;
      setBubble({
        kind: "reaction",
        reaction,
        text: reactionText(reaction, t, {
          localeTag,
          variant: variant.current,
          mascotTitle: levelTitle(reaction.level ?? level, locale),
        }),
        // Re-open (and restart the animation) even when the same reaction
        // fires twice in a row.
        nonce: now,
      });
    });
  }, [hidden, level, locale, localeTag, t]);

  // Nobody has touched anything for a while: offer the next step instead of
  // waiting to be asked. Any input at all resets the clock.
  useEffect(() => {
    if (hidden || bubble) return;

    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastIdleNudge.current < IDLE_COOLDOWN_MS) return arm();
        if (now - lastSpoke.current < IDLE_MS) return arm();
        lastIdleNudge.current = now;
        lastSpoke.current = now;
        setBubble({ kind: "suggestion", idle: true });
      }, IDLE_MS);
    };

    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, arm, { passive: true });
    arm();
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, arm);
    };
  }, [bubble, hidden]);

  // Auto-collapse. Celebrations linger longer than nudges, and a milestone
  // (level up, lesson cleared) longer still — it is worth reading twice.
  useEffect(() => {
    if (!bubble) return;
    const hold = bubble.kind === "reaction" ? bubble.reaction.hold : AUTO_COLLAPSE_MS;
    const timer = setTimeout(() => setBubble(null), hold);
    return () => clearTimeout(timer);
  }, [bubble]);

  const toggle = useCallback(() => {
    setBubble((current) => {
      lastSpoke.current = Date.now();
      return current ? null : { kind: "suggestion", idle: false };
    });
  }, []);

  if (hidden || !mounted) return null;

  const { message, cta } = describe(action, t, {
    localeTag,
    nextMascotTitle: levelTitle((action.level ?? level) as number, locale),
  });

  const reaction = bubble?.kind === "reaction" ? bubble.reaction : null;
  // A milestone is congratulation plus a door: "well done — here is what's
  // next". Small talk during a lesson gets no button, because the thing to do
  // next is already under the learner's thumb.
  const showCta = !reaction || reaction.tier === "milestone";
  const heading = reaction
    ? moodLabel(reaction.mood, t)
    : bubble?.kind === "suggestion" && bubble.idle
      ? t.hint
      : levelTitle(level, locale);

  return (
    <div
      className={cn(
        "fixed right-3 z-30 flex items-end gap-2 sm:right-5",
        // Clear the mobile bottom nav (h-16) plus the iOS home indicator.
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5",
      )}
    >
      {bubble && (
        <div
          key={bubble.kind === "reaction" ? bubble.nonce : "suggestion"}
          role="status"
          className={cn(
            "animate-pop max-w-[15rem] rounded-2xl rounded-br-sm border bg-card p-3 shadow-[var(--shadow-md)] sm:max-w-[17rem]",
            reaction?.mood === "cheer"
              ? "border-primary/40 ring-1 ring-primary/15"
              : "border-border",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-[11px] font-black uppercase tracking-[0.14em]",
                reaction?.mood === "calm" ? "text-muted" : "text-primary",
              )}
            >
              {heading}
            </p>
            <button
              onClick={() => setBubble(null)}
              aria-label={t.collapse}
              className="focus-ring -mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              <Icon name="plus" size={13} className="rotate-45" />
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-fg">
            {bubble.kind === "reaction" ? bubble.text : message}
          </p>
          {showCta && (
            <Link
              href={href(action.href)}
              onClick={() => setBubble(null)}
              className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/16"
            >
              {cta}
              <Icon name="arrow-right" size={15} />
            </Link>
          )}
        </div>
      )}

      <button
        onClick={toggle}
        aria-expanded={bubble != null}
        aria-label={bubble ? t.collapse : `${t.label}: ${t.expand}`}
        title={t.label}
        className="focus-ring relative grid h-14 w-14 shrink-0 place-items-center rounded-full border border-border bg-card shadow-[var(--shadow-md)] transition-transform hover:-translate-y-0.5 active:scale-95 sm:h-16 sm:w-16"
        style={{
          background: `radial-gradient(circle at 50% 28%, color-mix(in srgb, ${mascot.accent} 26%, var(--card)), var(--card))`,
        }}
      >
        {reaction?.mood === "cheer" && (
          <span
            aria-hidden
            className="animate-ring absolute inset-0 rounded-full border-2 border-primary"
          />
        )}
        <Mascot
          key={reaction ? `${reaction.key}-${bubble?.kind === "reaction" ? bubble.nonce : 0}` : "idle"}
          slug={mascot.slug}
          size={44}
          className={
            reaction?.mood === "cheer"
              ? "animate-cheer"
              : reaction
                ? "animate-nod"
                : bubble
                  ? undefined
                  : "animate-float"
          }
        />
        {!bubble && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary"
          />
        )}
      </button>
    </div>
  );
}

type CompanionDict = ReturnType<typeof useI18n>["dictionary"]["companion"];

function moodLabel(mood: Mood, t: CompanionDict): string {
  if (mood === "cheer") return t.moodCheer;
  if (mood === "calm") return t.moodCalm;
  return t.moodWarm;
}

/** Deterministic rotation through the variants of a repeatable line. */
function pick(lines: string[], variant: number): string {
  return lines[variant % lines.length];
}

/** Maps a reaction onto localized copy. */
function reactionText(
  reaction: CompanionReaction,
  t: CompanionDict,
  ctx: { localeTag: string; variant: number; mascotTitle: string },
): string {
  const r = t.react;
  switch (reaction.key) {
    case "levelUp":
      return r.levelUp(reaction.level ?? 0, ctx.mascotTitle);
    case "lessonCleared":
      return pick(r.lessonCleared, ctx.variant);
    case "readingPerfect":
      return r.readingPerfect(reaction.total ?? 0);
    case "readingPassed":
      return r.readingPassed(reaction.correct ?? 0, reaction.total ?? 0);
    case "readingMissed":
      return r.readingMissed(reaction.correct ?? 0, reaction.total ?? 0);
    case "missionCleared":
      return r.missionCleared(reaction.streak ?? 0);
    case "firstPass":
      return pick(r.firstPass, ctx.variant);
    case "newBest":
      return r.newBest(reaction.delta ?? 0);
    case "nearPass":
      return r.nearPass(reaction.gap ?? 0);
    case "hardSentence":
      return pick(r.hardSentence, ctx.variant);
    case "keepGoing":
      return pick(r.keepGoing, ctx.variant);
    case "vocabLearned":
      return r.vocabLearned(reaction.words ?? 0);
    case "vocabCleared":
      return r.vocabCleared;
  }
}

/** Maps the engine's decision onto localized copy. */
function describe(
  action: CompanionAction,
  t: CompanionDict,
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
    case "readingRead":
      return { message: t.readingRead, cta: t.readingReadCta };
    case "readingDone":
      return { message: t.readingDone, cta: t.readingDoneCta };
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

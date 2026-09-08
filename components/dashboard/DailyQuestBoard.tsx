"use client";

// The daily quest board.
//
// Three quests, one per skill the app teaches, plus a bonus that only unlocks
// when all three are cleared. The bonus meter spans all three, so the cheapest
// XP on screen is always the quest the learner was about to skip.
//
// It is laid out as a full-width row of three cards rather than a sidebar list
// on purpose: as a vertical list it stood ~390px tall, taller than anything it
// could sit beside (the dashboard hero, the progress heatmap), and left a hole
// in the opposite column on every page that used it. Across the full width the
// three quests sit side by side and the section is short enough to have no
// facing column at all.
//
// Every incomplete quest is a link. A board that shows what is missing without
// offering the door to it is a scoreboard, not a to-do list.

import Link from "next/link";
import { useI18n } from "@/components/i18n/useI18n";
import { Icon, type IconName } from "@/components/ui/icon";
import { todayKey } from "@/lib/date";
import { PERFECT_DAY_XP, type QuestId, type QuestView } from "@/lib/gamification/quests";
import type { DayStat, QuestBoardView } from "@/lib/store/selectors";

interface QuestChrome {
  icon: IconName;
  tone: string;
}

const CHROME: Record<QuestId, QuestChrome> = {
  shadowing: { icon: "mic", tone: "var(--c-emerald)" },
  reading: { icon: "book", tone: "var(--c-sky)" },
  vocab: { icon: "cap", tone: "var(--c-amber)" },
};

function QuestCard({
  quest,
  title,
  body,
  unit,
  cta,
  href,
}: {
  quest: QuestView;
  title: string;
  body: string;
  unit: string;
  cta: string;
  href: string | null;
}) {
  const { dictionary: m } = useI18n();
  const chrome = CHROME[quest.id];
  const pct = quest.target > 0 ? Math.min(100, (quest.done / quest.target) * 100) : 0;
  const tone = quest.completed ? "var(--success)" : chrome.tone;

  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        <span
          className="tile-icon h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={{ ["--tile-c" as string]: tone }}
        >
          <Icon
            name={quest.completed ? "check" : chrome.icon}
            size={19}
            strokeWidth={quest.completed ? 2.6 : 2}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-fg">
          {title}
        </span>
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums"
          style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
        >
          +{quest.xp} XP
        </span>
      </span>

      <span className="mt-2.5 block text-xs leading-5 text-muted">{body}</span>

      <span className="mt-auto block pt-3">
        <span className="flex h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_13%,var(--surface))]">
          <span
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, background: tone }}
          />
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-bold tabular-nums" style={{ color: tone }}>
            {quest.completed ? m.quests.done : unit}
          </span>
          {!quest.completed && href && (
            <span className="inline-flex items-center gap-1 font-bold text-primary">
              {cta}
              <Icon name="chevron-right" size={14} />
            </span>
          )}
        </span>
      </span>
    </>
  );

  const shell = "group flex h-full flex-col rounded-2xl border p-3.5 transition-colors";

  if (quest.completed || !href) {
    return (
      <li
        className={`${shell} border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,transparent)]`}
      >
        {inner}
      </li>
    );
  }

  return (
    <li className="flex">
      <Link
        href={href}
        className={`focus-ring ${shell} w-full border-border bg-surface hover:border-primary/35 hover:bg-primary/[0.03]`}
      >
        {inner}
      </Link>
    </li>
  );
}

/**
 * The last seven days as seven dots, sitting in the quest board's header.
 *
 * This replaces the standalone WeekSummary bar chart. That card answered the
 * same question as the board it sat beside — "did I practise today?" — at the
 * cost of a full-width section, and the dots carry the streak-shaped reading
 * (an unbroken run) better than seven bars ever did. Depth of colour is the
 * amount practised; today gets a ring whether or not it is filled yet.
 */
function WeekDots({ stats }: { stats: DayStat[] }) {
  const { dictionary: m } = useI18n();
  const total = stats.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(1, ...stats.map((day) => day.count));
  const today = todayKey();
  const active = stats.filter((day) => day.count > 0).length;

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] px-3.5 py-2.5 shadow-[var(--shadow-sm)]">
      <span className="tile-icon h-10 w-10 shrink-0" style={{ ["--tile-c" as string]: "var(--accent)" }}>
        <Icon name="trending" size={18} />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5">
          <b className="text-xl font-extrabold tabular-nums leading-6 tracking-[-0.03em] text-fg">
            {total}
          </b>
          <span className="text-[11px] font-bold text-muted">
            {m.weekSummary.passSuffix.trim()} · {m.weekSummary.short}
          </span>
        </span>
        <span className="mt-2 flex items-center gap-1.5">
          {stats.map((day) => {
            const isToday = day.date === today;
            // Three steps, not a continuous ramp: a single passed sentence has
            // to read as "a day with practice", not a barely-tinted dot.
            const strong = day.count > 0 && day.count >= max * 0.66;
            return (
              <span
                key={day.date}
                title={`${day.date} · ${day.count}${m.common.sentences}`}
                className={`rounded-full transition-all ${isToday ? "h-4 w-4" : "h-3 w-3"}`}
                style={{
                  background: strong
                    ? "linear-gradient(140deg, var(--g1), var(--g2))"
                    : day.count > 0
                      ? "color-mix(in srgb, var(--accent) 58%, var(--card))"
                      : "transparent",
                  boxShadow: [
                    day.count > 0
                      ? "0 2px 6px -3px color-mix(in srgb, var(--accent) 75%, transparent)"
                      : "inset 0 0 0 1.5px color-mix(in srgb, var(--primary) 26%, transparent)",
                    isToday
                      ? "0 0 0 2.5px color-mix(in srgb, var(--accent) 30%, transparent)"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(", "),
                }}
              >
                <span className="sr-only">
                  {day.date}: {day.count}
                </span>
              </span>
            );
          })}
          <span className="ml-1 text-[11px] font-black tabular-nums text-primary">
            {active}/7
          </span>
        </span>
      </span>
    </div>
  );
}

export function DailyQuestBoard({
  board,
  hrefs,
  week,
  loginHref,
}: {
  board: QuestBoardView;
  /** Where each unfinished quest sends the learner. null hides the CTA. */
  hrefs: Record<QuestId, string | null>;
  /** Last seven days of passed sentences, oldest first. */
  week?: DayStat[];
  /**
   * Set for a signed-out visitor: the board is shown to them too (it is the
   * clearest picture of what a day here looks like), with the seven-day strip
   * — which they have no data for — replaced by a way in.
   */
  loginHref?: string | null;
}) {
  const { dictionary: m } = useI18n();
  const t = m.quests;
  const bonusPct = board.total > 0 ? (board.cleared / board.total) * 100 : 0;

  // Keyed off the quest itself rather than its position, so the board survives
  // a reordering (or a fourth quest) without silently mislabelling a card.
  const copyFor = (quest: QuestView) => {
    if (quest.id === "shadowing") {
      return {
        title: t.shadowingTitle,
        body: t.shadowingBody(quest.target),
        unit: t.shadowingUnit(quest.done, quest.target),
        cta: t.shadowingCta,
      };
    }
    if (quest.id === "reading") {
      return {
        title: t.readingTitle,
        body: t.readingBody(quest.target),
        unit: t.readingUnit(quest.done, quest.target),
        cta: t.readingCta,
      };
    }
    return {
      title: t.vocabTitle,
      body: t.vocabBody(quest.target),
      unit: t.vocabUnit(quest.done, quest.target),
      cta: t.vocabCta,
    };
  };

  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-label={t.title}>
      {board.perfect && (
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[var(--c-violet)]/[0.12] blur-2xl" />
      )}

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
            {t.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em] sm:text-xl">
            {board.perfect ? t.allDone : t.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {board.perfect ? t.allDoneBody(board.xpEarned) : t.remaining(board.xpRemaining)}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto sm:flex-nowrap">
          {week && week.length > 0 && <WeekDots stats={week} />}
          {loginHref && (
            <Link
              href={loginHref}
              className="focus-ring group flex shrink-0 items-center gap-3 rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] px-3.5 py-2.5 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40"
            >
              <span
                className="tile-icon h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={{ ["--tile-c" as string]: "var(--accent)" }}
              >
                <Icon name="flame" size={18} filled />
              </span>
              <span className="max-w-[15rem] text-xs font-bold leading-5 text-fg">
                {t.guestNote}
              </span>
              <Icon name="chevron-right" size={16} className="shrink-0 text-primary" />
            </Link>
          )}
          <span
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-black tabular-nums"
            style={{
              color: board.perfect ? "var(--c-violet)" : "var(--muted)",
              background: board.perfect
                ? "color-mix(in srgb, var(--c-violet) 14%, transparent)"
                : "color-mix(in srgb, var(--muted) 10%, transparent)",
            }}
          >
            {t.cleared(board.cleared, board.total)}
          </span>
        </div>
      </header>

      <ul className="relative mt-4 grid gap-3 md:grid-cols-3">
        {board.quests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} {...copyFor(quest)} href={hrefs[quest.id]} />
        ))}
      </ul>

      <div
        className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border px-3.5 py-3"
        style={{
          borderColor: board.perfect
            ? "color-mix(in srgb, var(--c-violet) 40%, transparent)"
            : "var(--border)",
          background: board.perfect
            ? "color-mix(in srgb, var(--c-violet) 8%, transparent)"
            : "var(--surface)",
        }}
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            color: board.perfect ? "var(--c-violet)" : "var(--muted)",
            background: board.perfect
              ? "color-mix(in srgb, var(--c-violet) 14%, transparent)"
              : "color-mix(in srgb, var(--muted) 10%, transparent)",
          }}
        >
          <Icon name="trophy" size={17} filled={board.perfect} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold">
            <span>{t.bonusTitle}</span>
            <span
              className="tabular-nums"
              style={{ color: board.perfect ? "var(--c-violet)" : "var(--muted)" }}
            >
              +{PERFECT_DAY_XP} XP
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {board.perfect ? t.bonusEarned : t.bonusLocked(board.total - board.cleared)}
          </p>
        </div>

        <div className="flex h-1.5 w-full min-w-32 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_13%,var(--surface))] sm:w-auto sm:flex-1">
          <span
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${bonusPct}%`, background: "var(--c-violet)" }}
          />
        </div>
      </div>
    </section>
  );
}

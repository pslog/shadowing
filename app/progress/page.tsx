"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  averageScore,
  dailyPassStats,
  questHistory,
  type Skill,
  totalCompletedLessons,
  totalPassedSentences,
  weakestSkill,
} from "@/lib/store/selectors";
import {
  levelProgress,
  levelTitle,
} from "@/lib/gamification/level";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { Icon, type IconName } from "@/components/ui/icon";
import { CalendarHeatmap } from "@/components/progress/CalendarHeatmap";
import { MascotJourney } from "@/components/progress/MascotJourney";
import { QuestHistory } from "@/components/progress/QuestHistory";
import { useI18n } from "@/components/i18n/useI18n";
import type { Dictionary } from "@/lib/i18n";

function skillLabel(t: Dictionary["progress"], skill: Skill): string {
  if (skill === "pronunciation") return t.skillPronunciation;
  if (skill === "speed") return t.skillSpeed;
  return t.skillIntonation;
}

function MiniMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconName;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface/70 px-3.5 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-extrabold tabular-nums">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function FocusRow({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
      style={{ ["--focus-c" as string]: tone }}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--focus-c)_14%,transparent)] text-[var(--focus-c)]">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <p className="text-sm font-extrabold">{label}</p>
        <p className="mt-0.5 text-sm leading-5 text-muted">{value}</p>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { state, ready } = useData();
  const { locale, localeTag, dictionary, href } = useI18n();
  const t = dictionary.progress;
  const profile = state.profile;
  const avg = averageScore(state);
  const weak = weakestSkill(state);
  const history = questHistory(state, 30);
  const perfectDays = history.filter((day) => day.perfect).length;
  const activeDays = history.filter((day) => day.cleared > 0).length;
  const totalXp = profile?.total_xp ?? 0;
  const lp = levelProgress(totalXp);
  const sentenceEstimate = Math.max(1, Math.ceil(lp.toNext / 5));
  const nextLevelHint =
    lp.toNext <= 100
      ? t.focusNextLevelClose
      : t.focusNextLevelEstimate(sentenceEstimate);

  if (!ready) return <FullScreenLoading />;

  if (!profile) {
    return (
      <AppShell>
        <div className="animate-in mx-auto max-w-3xl py-4 sm:py-10">
          <p className="text-sm font-bold text-primary">{t.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">
            {t.guestTitle}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t.intro}</p>

          <section className="card relative mt-6 overflow-hidden border-primary/20 p-6 shadow-[var(--shadow-md)] sm:p-9">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/[0.07] blur-2xl" />
            <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon name="trending" size={23} />
            </span>
            <h2 className="relative mt-5 text-xl font-extrabold">
              {dictionary.login.welcomeBack}
            </h2>
            <p className="relative mt-2 max-w-lg text-sm leading-6 text-muted">
              {dictionary.login.noteOptional}
            </p>
            <Link
              href={href("/login")}
              className="focus-ring relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 font-extrabold text-white shadow-[var(--shadow-accent)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {dictionary.common.login}
              <Icon name="arrow-right" size={17} />
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="animate-in">
        <p className="text-sm font-bold text-primary">{t.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {profile
            ? `${levelTitle(lp.level, locale)} · Lv.${lp.level}`
            : t.guestTitle}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">{t.intro}</p>
      </div>

      <section className="mt-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-lg)]">
            <div className="brand-gradient p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    {t.currentPosition}
                  </p>
                  <p className="mt-2 text-5xl font-extrabold leading-none sm:text-6xl">
                    Lv.{lp.level}
                  </p>
                  <p className="mt-1.5 text-base font-bold text-white/90">
                    {levelTitle(lp.level, locale)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 px-3.5 py-2.5 text-right backdrop-blur">
                  <p className="text-xs text-white/75">{t.totalXp}</p>
                  <p className="text-xl font-extrabold tabular-nums">
                    {totalXp.toLocaleString(localeTag)}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between gap-3 text-sm">
                  <span className="font-bold">{t.toNextLevel(lp.level + 1)}</span>
                  <span className="font-extrabold tabular-nums">
                    {t.remainingXp(lp.toNext.toLocaleString(localeTag))}
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${lp.pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/75 tabular-nums">
                  {lp.intoLevel.toLocaleString(localeTag)} /{" "}
                  {lp.perLevel.toLocaleString(localeTag)} XP
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 p-3.5 sm:grid-cols-3">
              <MiniMetric
                label={t.metricStreak}
                value={`${profile?.current_streak ?? 0}${dictionary.common.days}`}
                icon="flame"
              />
              <MiniMetric
                label={t.metricBestStreak}
                value={`${profile?.longest_streak ?? 0}${dictionary.common.days}`}
                icon="trophy"
              />
              <MiniMetric
                label={t.metricWeakSkill}
                value={weak ? skillLabel(t, weak) : "-"}
                icon="target"
              />
            </div>
          </div>

          <div className="grid content-start gap-2.5">
            <FocusRow
              label={t.focusConsistency}
              value={t.focusConsistencyValue(activeDays, 30, perfectDays)}
              icon="flame"
              tone="var(--c-amber)"
            />
            <FocusRow
              label={t.focusNextLevel}
              value={nextLevelHint}
              icon="star"
              tone="var(--c-violet)"
            />
            <FocusRow
              label={t.focusScore}
              value={
                weak ? t.focusScoreWeak(skillLabel(t, weak)) : t.focusScoreNone
              }
              icon="target"
              tone="var(--c-sky)"
            />
          </div>
        </div>

        <div className="mt-4">
          <QuestHistory history={history} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(300px,1.15fr)]">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <MiniMetric
              label={t.metricLessonsDone}
              value={totalCompletedLessons(state)}
              icon="trophy"
            />
            <MiniMetric
              label={t.metricSentencesPassed}
              value={totalPassedSentences(state)}
              icon="check"
            />
            <MiniMetric label={t.metricAverage} value={avg ?? "-"} icon="gauge" />
            <MiniMetric
              label={t.metricNextLevelPct}
              value={`${lp.pct}%`}
              icon="sparkles"
            />
          </div>
          <CalendarHeatmap
            stats={dailyPassStats(state, 30)}
            currentStreak={profile?.current_streak ?? 0}
            longestStreak={profile?.longest_streak ?? 0}
          />
        </div>

        <div className="mt-4">
          <MascotJourney currentLevel={lp.level} totalXp={totalXp} />
        </div>
      </section>
    </AppShell>
  );
}

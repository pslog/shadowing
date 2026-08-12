"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/lib/store/DataProvider";
import {
  averageScore,
  dailyPassStats,
  type Skill,
  todayMission,
  totalCompletedLessons,
  totalPassedSentences,
  weakestSkill,
} from "@/lib/store/selectors";
import {
  levelMascot,
  levelProgress,
  levelTitle,
  visibleLevelMap,
  type LevelMilestone,
} from "@/lib/gamification/level";
import { Mascot, MascotBadge } from "@/components/ui/mascot";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { CalendarHeatmap } from "@/components/progress/CalendarHeatmap";
import { useI18n } from "@/components/i18n/useI18n";
import type { Dictionary } from "@/lib/i18n";

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  totalXp: number;
  level: number;
  streak: number;
  passed: number;
}

interface LeaderboardPayload {
  topXp: LeaderboardUser[];
  ranks: { userId: string; rank: number }[];
}

function skillLabel(t: Dictionary["progress"], skill: Skill): string {
  if (skill === "pronunciation") return t.skillPronunciation;
  if (skill === "speed") return t.skillSpeed;
  return t.skillIntonation;
}

const MARKER_POSITIONS = [
  { x: 10, y: 82 },
  { x: 19, y: 78 },
  { x: 27, y: 72 },
  { x: 35, y: 66 },
  { x: 42, y: 59 },
  { x: 48, y: 51 },
  { x: 53, y: 43 },
  { x: 57, y: 34 },
  { x: 55, y: 25 },
  { x: 50, y: 15 },
];

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

function levelTitleSize(title: string): string {
  if (title.length >= 10) return "text-[9px] leading-[11px] whitespace-normal";
  return "text-[10px] leading-3";
}

function MountainRoadmap({
  levels,
  currentLevel,
  totalXp,
  t,
  localeTag,
}: {
  levels: LevelMilestone[];
  currentLevel: number;
  totalXp: number;
  t: Dictionary["progress"];
  localeTag: string;
}) {
  const displayLevels = levels.filter((item) => item.level <= 10);
  const activeIndex = Math.min(Math.max(currentLevel, 1), 10) - 1;
  const currentPosition = MARKER_POSITIONS[activeIndex] ?? MARKER_POSITIONS[0];
  const currentMascot = levelMascot(currentLevel);

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>{t.roadmapTitle}</CardTitle>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
          Lv.{currentLevel}
        </span>
      </div>

      <div className="relative mt-4 h-[18.5rem] overflow-hidden rounded-3xl border border-border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <Image
          src="/progress/fuji-roadmap.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_44%,rgba(255,255,255,0.42)_100%)] dark:bg-[linear-gradient(180deg,rgba(14,15,28,0.06)_0%,rgba(14,15,28,0.1)_46%,rgba(14,15,28,0.45)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(75%_65%_at_12%_82%,rgba(255,255,255,0.72),rgba(255,255,255,0.08)_56%,transparent_78%)] dark:bg-[radial-gradient(75%_65%_at_12%_82%,rgba(14,15,28,0.42),rgba(14,15,28,0.08)_56%,transparent_78%)]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M10 82 C17 80, 21 77, 27 72 S38 63, 42 59 S51 48, 53 43 S60 31, 55 25 S52 18, 50 15"
            fill="none"
            stroke="rgba(255,255,255,0.86)"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
          <path
            d="M10 82 C17 80, 21 77, 27 72 S38 63, 42 59 S51 48, 53 43 S60 31, 55 25 S52 18, 50 15"
            fill="none"
            stroke="currentColor"
            strokeDasharray="2.8 3.2"
            strokeLinecap="round"
            strokeWidth="1.7"
            className="text-primary/70"
          />
        </svg>

        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-2xl border border-white/55 bg-card/85 px-3 py-2 text-sm font-extrabold shadow-[var(--shadow-sm)] backdrop-blur-md">
          <Icon name="trophy" size={16} className="text-[var(--c-amber)]" />
          {t.roadmapMountain}
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y}%` }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/60 bg-card/90 shadow-[var(--shadow-glow)] backdrop-blur">
            <Mascot slug={currentMascot.slug} size={34} />
          </div>
          <span className="-ml-5 mt-2 block rounded-full border border-white/60 bg-card/95 px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
            {t.roadmapHere}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-5">
        {displayLevels.map((item) => {
          const reached = totalXp >= item.minXp;
          const current = item.level === currentLevel;
          return (
            <div
              key={item.level}
              className={[
                "flex min-h-[3.05rem] items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-colors",
                current
                  ? "border-primary bg-primary/10"
                  : reached
                    ? "border-[var(--c-emerald)]/35 bg-[var(--c-emerald)]/10"
                    : "border-border bg-surface/70",
              ].join(" ")}
              title={`${item.minXp.toLocaleString(localeTag)} XP`}
            >
              <MascotBadge
                slug={item.mascot.slug}
                accent={item.mascot.accent}
                size={34}
                dimmed={!reached}
              />
              <div className="min-w-0">
                <p className="text-[9px] font-bold tabular-nums text-muted">
                  Lv.{item.level}
                </p>
                <p className={`font-extrabold tracking-[-0.02em] ${levelTitleSize(item.title)}`}>
                  {item.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Soft metallic medallions for the podium. Dark, matching icon color so the
// trophy/number stays legible instead of a glaring white-on-gold.
const MEDAL: Record<number, { bg: string; fg: string }> = {
  0: { bg: "linear-gradient(140deg, #fbe3a1 0%, #eab308 100%)", fg: "#7a4d05" },
  1: { bg: "linear-gradient(140deg, #eef2f7 0%, #b6c0cd 100%)", fg: "#495768" },
  2: { bg: "linear-gradient(140deg, #f0d0af 0%, #c9884f 100%)", fg: "#653414" },
};

function LeaderboardList({
  users,
  currentUserId,
  t,
  localeTag,
}: {
  users: LeaderboardUser[];
  currentUserId: string | null;
  t: Dictionary["progress"];
  localeTag: string;
}) {
  const podium = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>{t.leaderboardTitle}</CardTitle>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
          Top {users.length || "-"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">{t.leaderboardBody}</p>

      {users.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4">
          <p className="text-sm font-bold">{t.leaderboardEmptyTitle}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{t.leaderboardEmptyBody}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2.5">
            {podium.map((user, i) => (
              <PodiumUser
                user={user}
                rank={i + 1}
                isMe={user.id === currentUserId}
                key={user.id}
                t={t}
                localeTag={localeTag}
              />
            ))}
          </div>

          {rest.length > 0 && (
            <div className="space-y-1.5">
              {rest.map((user, i) => (
                <LeaderboardRow
                  user={user}
                  rank={i + 4}
                  isMe={user.id === currentUserId}
                  key={user.id}
                  t={t}
                  localeTag={localeTag}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PodiumUser({
  user,
  rank,
  isMe,
  t,
  localeTag,
}: {
  user: LeaderboardUser;
  rank: number;
  isMe: boolean;
  t: Dictionary["progress"];
  localeTag: string;
}) {
  const medal = MEDAL[rank - 1];
  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl border px-3 py-2.5",
        rank === 1
          ? "border-[var(--c-amber)]/35 bg-[var(--c-amber)]/10"
          : isMe
            ? "border-primary/30 bg-primary/[0.06]"
            : "border-border bg-surface/75",
      ].join(" ")}
    >
      {rank === 1 && (
        <div className="pointer-events-none absolute -right-8 -top-12 h-28 w-28 rounded-full bg-[var(--c-amber)]/15 blur-2xl" />
      )}
      <div className="relative flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums shadow-[var(--shadow-sm)]"
          style={{ background: medal.bg, color: medal.fg }}
        >
          {rank}
        </span>
        <Avatar
          src={user.avatarUrl}
          name={user.displayName}
          className="h-9 w-9 rounded-lg text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-extrabold">
            <span className="truncate">{user.displayName}</span>
            {isMe && (
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {t.you}
              </span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
            <span>Lv.{user.level}</span>
            <span>
              {user.passed}
              {t.passSuffix}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[var(--warning)]">
              <Icon name="flame" size={11} filled />
              {user.streak}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-black leading-none tabular-nums text-fg">
            {user.totalXp.toLocaleString(localeTag)}
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-muted">XP</p>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  user,
  rank,
  isMe,
  t,
  localeTag,
}: {
  user: LeaderboardUser;
  rank: number;
  isMe: boolean;
  t: Dictionary["progress"];
  localeTag: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
        isMe ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-surface/60",
      ].join(" ")}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-card text-xs font-black tabular-nums text-muted">
        {rank}
      </span>
      <Avatar
        src={user.avatarUrl}
        name={user.displayName}
        className="h-9 w-9 rounded-xl text-xs"
        fallbackClassName="bg-primary/10 text-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
          <span className="truncate">{user.displayName}</span>
          {isMe && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {t.you}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Lv.{user.level} · {user.passed}
          {t.passSuffix} · {user.streak}
        </p>
      </div>
      <p className="shrink-0 text-sm font-black tabular-nums">
        {user.totalXp.toLocaleString(localeTag)}
        <span className="ml-0.5 text-[10px] text-muted">XP</span>
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const { state, ready } = useData();
  const { locale, localeTag, dictionary } = useI18n();
  const t = dictionary.progress;
  const profile = state.profile;
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LeaderboardPayload | null) => {
        if (!cancelled) setLeaderboard(data);
      })
      .catch(() => {
        if (!cancelled) setLeaderboard(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const avg = averageScore(state);
  const weak = weakestSkill(state);
  const mission = todayMission(state);
  const totalXp = profile?.total_xp ?? 0;
  const lp = levelProgress(totalXp);
  const roadmap = useMemo(() => visibleLevelMap(lp.level, locale), [locale, lp.level]);
  const myRank = profile
    ? (leaderboard?.ranks.find((rank) => rank.userId === profile.id)?.rank ?? null)
    : null;
  const missionLeft = Math.max(0, mission.target - mission.passed);
  const sentenceEstimate = Math.max(1, Math.ceil(lp.toNext / 5));
  const nextLevelHint =
    lp.toNext <= 100 && !mission.completed
      ? t.focusNextLevelClose
      : t.focusNextLevelEstimate(sentenceEstimate);

  if (!ready) return <FullScreenLoading />;

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
                label={t.metricRank}
                value={myRank ? `#${myRank}` : "-"}
                icon="trending"
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
              label={t.focusToday}
              value={
                mission.completed
                  ? t.focusTodayDone
                  : t.focusTodayLeft(missionLeft)
              }
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
      </section>

      <section className="mt-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <MountainRoadmap
            levels={roadmap}
            currentLevel={lp.level}
            totalXp={totalXp}
            t={t}
            localeTag={localeTag}
          />
          <LeaderboardList
            users={leaderboard?.topXp ?? []}
            currentUserId={profile?.id ?? null}
            t={t}
            localeTag={localeTag}
          />
        </div>
      </section>
    </AppShell>
  );
}

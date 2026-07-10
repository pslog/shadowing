"use client";

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
  levelProgress,
  levelTitle,
  visibleLevelMap,
  type LevelMilestone,
} from "@/lib/gamification/level";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { CalendarHeatmap } from "@/components/progress/CalendarHeatmap";

interface LeaderboardUser {
  id: string;
  displayName: string;
  totalXp: number;
  level: number;
  streak: number;
  passed: number;
}

interface LeaderboardPayload {
  topXp: LeaderboardUser[];
  ranks: { userId: string; rank: number }[];
}

const SKILL_LABEL_JA: Record<Skill, string> = {
  pronunciation: "発音",
  speed: "スピード",
  intonation: "イントネーション",
};

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
}: {
  levels: LevelMilestone[];
  currentLevel: number;
  totalXp: number;
}) {
  const displayLevels = levels.filter((item) => item.level <= 10);
  const activeIndex = Math.min(Math.max(currentLevel, 1), 10) - 1;
  const currentPosition = MARKER_POSITIONS[activeIndex] ?? MARKER_POSITIONS[0];

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>レベルロードマップ</CardTitle>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
          Lv.{currentLevel}
        </span>
      </div>

      <div className="relative mt-4 h-[18.5rem] overflow-hidden rounded-3xl border border-border bg-[linear-gradient(180deg,#dff4ff_0%,#eef0ff_52%,#e8f7f1_100%)]">
        <div className="absolute right-8 top-7 h-14 w-14 rounded-full bg-[#ffd98b] shadow-[0_0_44px_rgba(245,147,49,0.35)]" />
        <div className="absolute left-8 top-9 h-3 w-24 rounded-full bg-white/70 blur-[1px]" />
        <div className="absolute right-28 top-16 h-2.5 w-20 rounded-full bg-white/65 blur-[1px]" />
        <div
          className="absolute inset-x-0 bottom-0 h-[33%] bg-[linear-gradient(180deg,#d7eee9,#f5fbf8)]"
          style={{ clipPath: "polygon(0 100%, 0 45%, 15% 58%, 30% 50%, 44% 64%, 58% 51%, 73% 63%, 100% 44%, 100% 100%)" }}
        />
        <div
          className="absolute inset-x-7 bottom-0 h-[82%] bg-[linear-gradient(130deg,#cec2ff_0%,#ded8ff_48%,#dcecff_100%)]"
          style={{ clipPath: "polygon(0 100%, 50% 8%, 100% 100%)" }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-[80%] w-1/2 bg-[linear-gradient(125deg,rgba(117,104,220,0.18),rgba(81,126,190,0.08))]"
          style={{ clipPath: "polygon(0 10%, 100% 100%, 0 100%)" }}
        />
        <div
          className="absolute left-1/2 top-[7%] h-24 w-40 -translate-x-1/2 bg-white/95"
          style={{ clipPath: "polygon(50% 0, 77% 72%, 62% 58%, 52% 86%, 41% 57%, 24% 72%)" }}
        />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M10 82 C17 80, 21 77, 27 72 S38 63, 42 59 S51 48, 53 43 S60 31, 55 25 S52 18, 50 15"
            fill="none"
            stroke="currentColor"
            strokeDasharray="2.4 3.4"
            strokeLinecap="round"
            strokeWidth="1.55"
            className="text-primary/55"
          />
        </svg>

        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-2xl bg-card/90 px-3 py-2 text-sm font-extrabold shadow-sm backdrop-blur">
          <Icon name="trophy" size={16} className="text-[var(--c-amber)]" />
          富士山
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y}%` }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/40 brand-gradient text-white shadow-[var(--shadow-glow)]">
            <Icon name="star" size={18} filled />
          </div>
          <span className="-ml-5 mt-2 block rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm">
            現在地
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
                "flex min-h-[2.9rem] items-center gap-1.5 rounded-xl border px-1.5 py-1",
                current
                  ? "border-primary bg-primary/10"
                  : reached
                    ? "border-[var(--c-emerald)]/35 bg-[var(--c-emerald)]/10"
                    : "border-border bg-surface/70",
              ].join(" ")}
              title={`${item.minXp.toLocaleString("ja-JP")} XP`}
            >
              <p
                className={[
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-extrabold tabular-nums",
                  current
                    ? "brand-gradient text-white"
                    : reached
                      ? "bg-[var(--c-emerald)] text-white"
                      : "bg-card text-muted",
                ].join(" ")}
              >
                {item.level}
              </p>
              <div className="min-w-0">
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

function LeaderboardList({ users }: { users: LeaderboardUser[] }) {
  return (
    <Card>
      <CardTitle>ランキング</CardTitle>
      <div className="mt-3 space-y-2">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-3">
            <p className="text-sm font-bold">まだランキングデータがありません</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              文をPassすると、XPランキングに反映されます。
            </p>
          </div>
        ) : (
          users.map((user, i) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 px-3 py-2"
            >
              <span
                className={[
                  "grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold tabular-nums",
                  i === 0
                    ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                    : "bg-card text-muted",
                ].join(" ")}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{user.displayName}</p>
                <p className="text-xs text-muted">
                  Lv.{user.level} · {user.passed}文Pass · {user.streak}日
                </p>
              </div>
              <div className="text-right text-sm font-extrabold tabular-nums">
                {user.totalXp.toLocaleString("ja-JP")} XP
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export default function ProgressPage() {
  const { state, ready } = useData();
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
  const roadmap = useMemo(() => visibleLevelMap(lp.level), [lp.level]);
  const myRank = profile
    ? (leaderboard?.ranks.find((rank) => rank.userId === profile.id)?.rank ?? null)
    : null;
  const missionLeft = Math.max(0, mission.target - mission.passed);
  const sentenceEstimate = Math.max(1, Math.ceil(lp.toNext / 5));
  const nextLevelHint =
    lp.toNext <= 100 && !mission.completed
      ? "今日のミッション完了で届く可能性があります。"
      : `目安は約${sentenceEstimate}文Pass。ミッション完了のXPも大きいです。`;

  if (!ready) return <FullScreenLoading />;

  return (
    <AppShell>
      <div className="animate-in">
        <p className="text-sm font-bold text-primary">進捗</p>
        <h1 className="mt-1 text-2xl font-bold">
          {profile ? `${levelTitle(lp.level)} · Lv.${lp.level}` : "ゲスト閲覧中"}
        </h1>
      </div>

      <section className="mt-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-lg)]">
            <div className="brand-gradient p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    現在地
                  </p>
                  <p className="mt-2 text-5xl font-extrabold leading-none sm:text-6xl">
                    Lv.{lp.level}
                  </p>
                  <p className="mt-1.5 text-base font-bold text-white/90">
                    {levelTitle(lp.level)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 px-3.5 py-2.5 text-right backdrop-blur">
                  <p className="text-xs text-white/75">総XP</p>
                  <p className="text-xl font-extrabold tabular-nums">
                    {totalXp.toLocaleString("ja-JP")}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between gap-3 text-sm">
                  <span className="font-bold">Lv.{lp.level + 1}まで</span>
                  <span className="font-extrabold tabular-nums">
                    あと{lp.toNext.toLocaleString("ja-JP")} XP
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${lp.pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/75 tabular-nums">
                  {lp.intoLevel.toLocaleString("ja-JP")} /{" "}
                  {lp.perLevel.toLocaleString("ja-JP")} XP
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 p-3.5 sm:grid-cols-3">
              <MiniMetric
                label="現在のストリーク"
                value={`${profile?.current_streak ?? 0}日`}
                icon="flame"
              />
              <MiniMetric
                label="XPランキング"
                value={myRank ? `#${myRank}` : "-"}
                icon="trending"
              />
              <MiniMetric
                label="優先スキル"
                value={weak ? SKILL_LABEL_JA[weak] : "-"}
                icon="target"
              />
            </div>
          </div>

          <div className="grid content-start gap-2.5">
            <FocusRow
              label="今日の最優先"
              value={
                mission.completed
                  ? "ミッション完了。余裕があれば短い文を復習しましょう。"
                  : `あと${missionLeft}文Passでストリークを維持できます。`
              }
              icon="flame"
              tone="var(--c-amber)"
            />
            <FocusRow
              label="次のレベル"
              value={nextLevelHint}
              icon="star"
              tone="var(--c-violet)"
            />
            <FocusRow
              label="スコア改善"
              value={
                weak
                  ? `${SKILL_LABEL_JA[weak]}を短い文で集中的に練習しましょう。`
                  : "まずは数回録音して、弱点を見える化しましょう。"
              }
              icon="target"
              tone="var(--c-sky)"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(300px,1.15fr)]">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <MiniMetric label="完了レッスン" value={totalCompletedLessons(state)} icon="trophy" />
            <MiniMetric label="Passした文" value={totalPassedSentences(state)} icon="check" />
            <MiniMetric label="平均スコア" value={avg ?? "-"} icon="gauge" />
            <MiniMetric label="次レベル進捗" value={`${lp.pct}%`} icon="sparkles" />
          </div>
          <CalendarHeatmap stats={dailyPassStats(state, 30)} />
        </div>
      </section>

      <section className="mt-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <MountainRoadmap levels={roadmap} currentLevel={lp.level} totalXp={totalXp} />
          <LeaderboardList users={leaderboard?.topXp ?? []} />
        </div>
      </section>
    </AppShell>
  );
}

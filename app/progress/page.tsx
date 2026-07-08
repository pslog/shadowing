"use client";

import { useEffect, useState } from "react";
import { useData } from "@/lib/store/DataProvider";
import {
  averageScore,
  dailyPassStats,
  SKILL_LABEL,
  totalCompletedLessons,
  totalPassedSentences,
  weakestSkill,
} from "@/lib/store/selectors";
import { levelProgress, levelTitle } from "@/lib/gamification/level";
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

function StatTile({
  label,
  value,
  icon,
  hue,
  i,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconName;
  hue: string;
  i: number;
}) {
  return (
    <div
      className="tile p-4"
      style={{ ["--tile-c" as string]: hue, ["--i" as string]: i }}
    >
      <span className="tile-icon mb-3 h-9 w-9">
        <Icon name={icon} size={17} />
      </span>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function LeaderboardList({ users }: { users: LeaderboardUser[] }) {
  return (
    <Card>
      <CardTitle>Top Learners</CardTitle>
      <div className="mt-3 space-y-2">
        {users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-3">
            <p className="text-sm font-bold">まだランキングデータがありません</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              1文録音してPassすると、ランキングに反映されます。
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

  if (!ready) return <FullScreenLoading />;

  const avg = averageScore(state);
  const weak = weakestSkill(state);
  const totalXp = profile?.total_xp ?? 0;
  const currentLevel = profile?.current_level ?? 1;
  const lp = levelProgress(totalXp);
  const myRank = profile
    ? (leaderboard?.ranks.find((rank) => rank.userId === profile.id)?.rank ?? null)
    : null;

  return (
    <AppShell>
      <div className="animate-in">
        <h1 className="text-2xl font-bold">進捗</h1>
        <p className="mb-5 text-muted">
          {profile ? `${levelTitle(currentLevel)} · Lv.${currentLevel}` : "ゲスト閲覧中"}
        </p>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="完了レッスン"
          value={totalCompletedLessons(state)}
          icon="trophy"
          hue="var(--c-amber)"
          i={0}
        />
        <StatTile
          label="Passした文"
          value={totalPassedSentences(state)}
          icon="check"
          hue="var(--c-emerald)"
          i={1}
        />
        <StatTile
          label="平均スコア"
          value={avg ?? "-"}
          icon="target"
          hue="var(--c-sky)"
          i={2}
        />
        <StatTile
          label="総XP"
          value={totalXp.toLocaleString("ja-JP")}
          icon="star"
          hue="var(--c-violet)"
          i={3}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="overflow-hidden p-0">
          <div className="brand-gradient p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              あなたの位置
            </p>
            <p className="mt-1 text-4xl font-extrabold">
              {profile ? (myRank ? `#${myRank}` : "-") : "Guest"}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {profile
                ? `XPランキング · ${totalXp.toLocaleString("ja-JP")} XP`
                : "録音して採点すると、あなたの順位が表示されます。"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-xl bg-surface p-3">
              <p className="font-extrabold">{profile?.current_streak ?? 0}日</p>
              <p className="text-xs text-muted">現在のストリーク</p>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <p className="font-extrabold">{weak ? SKILL_LABEL[weak] : "-"}</p>
              <p className="text-xs text-muted">重点スキル</p>
            </div>
          </div>
        </Card>

        <LeaderboardList users={leaderboard?.topXp ?? []} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardTitle>レベル進捗</CardTitle>
          <div className="mt-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
              <div
                className="h-full rounded-full brand-gradient transition-all"
                style={{ width: `${lp.pct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              Lv.{lp.level + 1}まであと{" "}
              <b className="text-fg">{lp.toNext} XP</b>
            </p>
          </div>
          {weak && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface p-3 text-sm">
              <Icon name="sparkles" size={16} className="mt-0.5 text-primary" />
              <span>
                総合スコアを上げるには{" "}
                <b className="text-primary">{SKILL_LABEL[weak]}</b>
                を重点的に練習しましょう。
              </span>
            </p>
          )}
        </Card>
        <CalendarHeatmap stats={dailyPassStats(state, 30)} />
      </div>
    </AppShell>
  );
}

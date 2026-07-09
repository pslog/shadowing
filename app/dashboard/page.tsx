"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  courseStats,
  dailyPassStats,
  inProgressLesson,
  isAdmin,
  passedThisWeek,
  todayMission,
  visibleCourses,
  visibleLessons,
  passedCountForLesson,
  sentencesForLesson,
} from "@/lib/store/selectors";
import { levelTitle } from "@/lib/gamification/level";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyMissionCard } from "@/components/dashboard/DailyMissionCard";
import { LevelCard } from "@/components/dashboard/LevelCard";
import { WeekSummary } from "@/components/dashboard/WeekSummary";
import { Icon } from "@/components/ui/icon";
import { CourseCard } from "@/components/lesson/CourseCard";
import { streakActiveToday } from "@/lib/gamification/streak";

export default function DashboardPage() {
  const { state, ready } = useData();
  const profile = state.profile;

  if (!ready) return <FullScreenLoading />;

  const mission = todayMission(state);
  const week = dailyPassStats(state, 7);
  const inProgress = inProgressLesson(state);
  const lessons = visibleLessons(state);
  const courses = visibleCourses(state);
  const startTarget = inProgress ?? lessons[0];
  const keptToday = profile ? streakActiveToday(profile.last_completed_date) : false;
  const displayName = profile?.display_name ?? "ゲスト";
  const currentLevel = profile?.current_level ?? 1;
  const totalXp = profile?.total_xp ?? 0;

  return (
    <AppShell>
      <div className="animate-in space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="relative overflow-hidden rounded-3xl brand-gradient p-7 text-white shadow-[var(--shadow-glow)] lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/20" />
            <div className="pointer-events-none absolute -right-4 -bottom-24 h-64 w-64 bg-white/10 blur-2xl" />

            <p className="text-sm font-medium text-white/80">こんにちは</p>
            <h1 className="mt-1 text-3xl font-extrabold">{displayName}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur">
                {levelTitle(currentLevel)} · Lv.{currentLevel}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur">
                今週: {passedThisWeek(state)}文
              </span>
            </div>

            <p className="mt-5 max-w-md text-white/85">
              {!profile
                ? "ログインしなくてもレッスンは閲覧できます。録音して採点するときだけログインしてください。"
                : mission.completed
                ? "今日のストリークは達成済みです。さらに練習してレベルアップしましょう。"
                : `今日のミッション完了まで、あと${mission.target - mission.passed}文Passしましょう。`}
            </p>
            {inProgress && (
              <p lang="ja" className="mt-1 text-sm text-white/70">
                学習中: <b>{inProgress.title}</b> (
                {passedCountForLesson(state, inProgress.id)}/
                {sentencesForLesson(state, inProgress.id).length})
              </p>
            )}

            {startTarget ? (
              <Link
                href={`/lessons/${startTarget.id}`}
                className="shine mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-[var(--primary)] shadow-lg transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
              >
                <Icon name="cap" size={18} />
                今日の練習を始める
                <Icon name="arrow-right" size={18} />
              </Link>
            ) : isAdmin(state) ? (
              <Link
                href="/lessons/new"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-[var(--primary)] shadow-lg"
              >
                <Icon name="plus" size={18} />
                最初のレッスンを作成
              </Link>
            ) : (
              <Link
                href="/courses"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-[var(--primary)] shadow-lg"
              >
                <Icon name="cap" size={18} />
                レッスン一覧を見る
              </Link>
            )}
          </section>

          <StreakCard
            current={profile?.current_streak ?? 0}
            longest={profile?.longest_streak ?? 0}
            keptToday={keptToday}
          />
        </div>

        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div style={{ ["--i" as string]: 0 }}>
            <DailyMissionCard
              passed={mission.passed}
              target={mission.target}
              completed={mission.completed}
            />
          </div>
          <div style={{ ["--i" as string]: 1 }}>
            <LevelCard totalXp={totalXp} />
          </div>
          <div style={{ ["--i" as string]: 2 }} className="sm:col-span-2 lg:col-span-1">
            <WeekSummary stats={week} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">コース</h2>
            <Link
              href="/courses"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              すべて見る <Icon name="chevron-right" size={15} />
            </Link>
          </div>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c, i) => (
              <div key={c.id} style={{ ["--i" as string]: i }}>
                <CourseCard
                  course={c}
                  stats={courseStats(state, c.id)}
                  href={`/courses/${c.id}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

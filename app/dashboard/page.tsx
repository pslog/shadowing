"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  courseStats,
  dailyPassStats,
  inProgressLesson,
  isAdmin,
  lastAttemptAtForLesson,
  lessonStatus,
  nextLessonInCourse,
  passedCountForLesson,
  passedThisWeek,
  recentAttemptedLessons,
  sentencesForLesson,
  todayMission,
  visibleCourses,
  visibleLessons,
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
  const recentLessons = recentAttemptedLessons(state, 3);
  const featuredCourse = courses[0] ?? null;
  const featuredLesson = featuredCourse
    ? nextLessonInCourse(state, featuredCourse.id)
    : (lessons[0] ?? null);
  const startTarget = inProgress ?? recentLessons[0] ?? featuredLesson;
  const keptToday = profile ? streakActiveToday(profile.last_completed_date) : false;
  const displayName = profile?.display_name ?? "ゲスト";
  const currentLevel = profile?.current_level ?? 1;
  const totalXp = profile?.total_xp ?? 0;

  return (
    <AppShell>
      <div className="animate-in space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="relative overflow-hidden rounded-3xl brand-gradient p-7 text-white shadow-[var(--shadow-glow)] lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/15" />
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
                  ? "今日のミッションは達成済みです。余裕があれば最近のレッスンを復習しましょう。"
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
                続きから始める
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
                コースを見る
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

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {recentLessons.length > 0 ? "続きから学習" : "おすすめコース"}
            </h2>
            <Link
              href="/courses"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              コースを見る <Icon name="chevron-right" size={15} />
            </Link>
          </div>

          {recentLessons.length > 0 ? (
            <div className="grid gap-3">
              {recentLessons.map((lesson, i) => {
                const total = sentencesForLesson(state, lesson.id).length;
                const passed = passedCountForLesson(state, lesson.id);
                const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
                const last = lastAttemptAtForLesson(state, lesson.id);
                const lastDate = last
                  ? new Date(last).toLocaleDateString("ja-JP", {
                      month: "long",
                      day: "numeric",
                    })
                  : null;
                const status = lessonStatus(state, lesson.id);
                return (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    style={{ ["--i" as string]: i }}
                    className="card card-interactive grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                        <span>{status === "completed" ? "復習" : "続きから"}</span>
                        <span className="tabular-nums">
                          {passed}/{total} 文
                        </span>
                        {lastDate && <span>最終学習日: {lastDate}</span>}
                      </div>
                      <p lang="ja" className="truncate text-base font-extrabold">
                        {lesson.title}
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_18%,transparent)]">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                      再開
                      <Icon name="arrow-right" size={15} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : featuredCourse ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <CourseCard
                course={featuredCourse}
                stats={courseStats(state, featuredCourse.id)}
                href={`/courses/${featuredCourse.id}`}
              />
              {featuredLesson && (
                <Link
                  href={`/lessons/${featuredLesson.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)]"
                >
                  最初のレッスンを始める
                  <Icon name="arrow-right" size={16} />
                </Link>
              )}
            </div>
          ) : featuredLesson ? (
            <Link
              href={`/lessons/${featuredLesson.id}`}
              className="card card-interactive flex items-center justify-between gap-3 p-4"
            >
              <span lang="ja" className="min-w-0 truncate font-extrabold">
                {featuredLesson.title}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                始める <Icon name="arrow-right" size={15} />
              </span>
            </Link>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

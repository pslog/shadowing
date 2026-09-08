"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { DailyQuestBoard } from "@/components/dashboard/DailyQuestBoard";
import { LeaderboardPanel } from "@/components/dashboard/LeaderboardPanel";
import { LibraryStats } from "@/components/dashboard/LibraryStats";
import { LevelMountain } from "@/components/dashboard/LevelMountain";
import { useI18n } from "@/components/i18n/useI18n";
import { AppShell } from "@/components/layout/AppShell";
import { CourseCard } from "@/components/lesson/CourseCard";
import { Icon } from "@/components/ui/icon";
import { FullScreenLoading } from "@/components/ui/loading";
import { levelProgress, levelTitle } from "@/lib/gamification/level";
import { optimizedImageSrc } from "@/lib/optimized-image";
import {
  courseHref,
  courseStats,
  dailyPassStats,
  inProgressLesson,
  isAdmin,
  lastAttemptAtForLesson,
  lessonHref,
  lessonStatus,
  nextLessonInCourse,
  nextReadingLesson,
  passedCountForLesson,
  recentAttemptedLessons,
  sentencesForLesson,
  suggestedCourses,
  todayMission,
  todayQuestBoard,
  visibleCourses,
  visibleLessons,
} from "@/lib/store/selectors";
import { useData } from "@/lib/store/DataProvider";

export default function DashboardPage() {
  const { state, ready, ensureLessonSentences, usingSupabase } = useData();
  const { locale, localeTag, dictionary: m, href } = useI18n();
  const copy = m.dashboard;
  const profile = state.profile;
  const mission = todayMission(state);
  const questBoard = todayQuestBoard(state);
  const week = dailyPassStats(state, 7);
  const inProgress = inProgressLesson(state);
  const lessons = visibleLessons(state);
  const courses = visibleCourses(state);
  const recentLessons = recentAttemptedLessons(state, 3);
  // The suggestion drives the hero too, so "Bắt đầu bài đầu tiên" and the
  // shelf below it point at the same course.
  const suggested = suggestedCourses(state, 2);
  const featuredCourse = suggested[0] ?? courses[0] ?? null;
  const featuredLesson = featuredCourse
    ? nextLessonInCourse(state, featuredCourse.id)
    : (lessons[0] ?? null);
  const startTarget = inProgress ?? recentLessons[0] ?? featuredLesson;
  const startCourse = startTarget?.course_id
    ? courses.find((course) => course.id === startTarget.course_id) ?? featuredCourse
    : featuredCourse;
  const startImage = optimizedImageSrc(startCourse?.image_url ?? null);
  const readingTarget = nextReadingLesson(state);
  const questHrefs = {
    shadowing: startTarget ? href(lessonHref(startTarget)) : href("/courses"),
    reading: readingTarget ? href(lessonHref(readingTarget)) : href("/courses"),
    vocab: href("/review"),
  };
  const totalXp = profile?.total_xp ?? 0;
  const currentLevel = levelProgress(totalXp).level;
  const sentenceLessonIds = [
    inProgress?.id,
    startTarget?.id,
    ...recentLessons.map((lesson) => lesson.id),
  ].filter((id): id is string => Boolean(id));
  const sentenceLessonKey = [...new Set(sentenceLessonIds)].join("|");

  useEffect(() => {
    if (!usingSupabase) return;
    const ids = sentenceLessonKey.split("|").filter(Boolean);
    if (ids.length > 0) void ensureLessonSentences(ids);
  }, [ensureLessonSentences, sentenceLessonKey, usingSupabase]);

  if (!ready) return <FullScreenLoading />;

  const actionHref = startTarget
    ? href(lessonHref(startTarget))
    : isAdmin(state)
      ? href("/lessons/new")
      : href("/courses");
  const actionLabel = startTarget
    ? profile && inProgress
      ? copy.resume
      : copy.firstLesson
    : isAdmin(state)
      ? copy.createFirst
      : copy.viewCourses;

  const heroEyebrow = profile
    ? `${copy.hello}, ${profile.display_name}`
    : copy.guestEyebrow;
  const heroTitle = profile ? startTarget?.title ?? copy.recommended : copy.guestTitle;
  const heroBody = profile
    ? mission.completed
      ? copy.missionDone
      : copy.missionLeft(Math.max(0, mission.target - mission.passed))
    : copy.guest;
  // Two, signed in or not: four filled two rows of tall cards and pushed the
  // rest of the page below the fold. The full shelf is one click away.
  const featuredCourses = suggested;

  return (
    <AppShell>
      <div className="animate-in space-y-7 sm:space-y-9">
        {/* One hero band instead of a plain greeting plus a pale card: the first
            screen now leads with colour, one headline and one clear action. */}
        <section className="brand-energy relative overflow-hidden rounded-[1.6rem] text-white shadow-[var(--shadow-lg)]">
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(16rem,0.88fr)] lg:items-center lg:gap-9 lg:p-10">
            <div className="flex flex-col items-start">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                <Icon name={profile ? "flame" : "sparkles"} size={13} filled />
                {heroEyebrow}
              </p>
              <h1
                lang={profile && startTarget ? "ja" : undefined}
                className="mt-4 max-w-xl text-[1.7rem] font-extrabold leading-[1.18] tracking-[-0.04em] sm:text-4xl"
              >
                {heroTitle}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/85 sm:text-[0.95rem]">
                {inProgress
                  ? `${copy.learning}: ${passedCountForLesson(state, inProgress.id)}/${sentencesForLesson(state, inProgress.id).length}${m.common.sentences}`
                  : heroBody}
              </p>

              {profile && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold tabular-nums backdrop-blur-sm">
                    <Icon name="flame" size={13} filled />
                    {profile.current_streak} {m.common.days}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm">
                    <Icon name="star" size={13} filled />
                    Lv.{currentLevel} · {levelTitle(currentLevel, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold tabular-nums backdrop-blur-sm">
                    {totalXp.toLocaleString(localeTag)} XP
                  </span>
                </div>
              )}

              <div className="mt-7 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Link
                  href={actionHref}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-white px-5 font-extrabold text-[var(--primary)] shadow-[0_16px_32px_-18px_rgba(20,10,60,0.7)] transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Icon name={startTarget ? "mic" : "book"} size={19} />
                  {actionLabel}
                  <Icon name="arrow-right" size={18} />
                </Link>
                <Link
                  href={href("/courses")}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/45 px-4 text-sm font-bold text-white transition-colors hover:bg-white/15"
                >
                  {copy.exploreCourses}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
            </div>

            <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border border-white/25 bg-white/10 shadow-[0_28px_60px_-30px_rgba(20,10,60,0.75)] sm:aspect-[2/1] lg:aspect-[16/11]">
              {startImage ? (
                <Image
                  src={startImage}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 34vw"
                  className="media-vivid object-contain p-3 lg:object-cover lg:object-[50%_22%] lg:p-0"
                  quality={78}
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <Icon name="mic" size={56} className="text-white/70" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-black/55 to-transparent lg:block" />
              <p lang="ja" className="absolute bottom-3 left-3 right-3 truncate rounded-lg bg-black/35 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur-sm">
                {startCourse?.title ?? copy.courseEyebrow}
              </p>
            </div>
          </div>
        </section>

        {/* Shown signed out as well: three quests and a bonus say what a day here
            looks like better than any paragraph could. */}
        <DailyQuestBoard
          board={questBoard}
          hrefs={questHrefs}
          week={profile ? week : undefined}
          loginHref={profile ? null : href("/login")}
        />

        {/* The scale of the library, in four numbers. */}
        <LibraryStats compact={Boolean(profile)} />

        {!profile && (
          <section aria-label={copy.guestMethodTitle}>
            <div className="mb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                {copy.methodEyebrow}
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em]">
                {copy.guestMethodTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{copy.guestMethodBody}</p>
            </div>
            {/* Three beats side by side, one hue each. As a vertical list of
                identical violet rows this read as filler. */}
            <ol className="stagger grid gap-3 sm:grid-cols-3">
              {[
                { label: copy.methodListen, icon: "play" as const, hue: "var(--c-sky)" },
                { label: copy.methodShadow, icon: "mic" as const, hue: "var(--accent)" },
                { label: copy.methodImprove, icon: "trending" as const, hue: "var(--c-amber)" },
              ].map((step, index) => (
                <li
                  key={step.label}
                  className="tile flex items-start gap-3 p-4 sm:p-5"
                  style={{ ["--tile-c" as string]: step.hue, ["--i" as string]: index }}
                >
                  <span className="tile-icon h-11 w-11 shrink-0">
                    <Icon name={step.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-muted">
                      {index + 1} / 3
                    </span>
                    <span className="mt-0.5 block text-base font-extrabold tracking-[-0.02em]">
                      {step.label}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                  {copy.courseEyebrow}
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em]">
                  {recentLessons.length > 0 ? copy.recent : copy.recommended}
                </h2>
              </div>
              <Link href={href("/courses")} className="focus-ring flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-primary hover:bg-primary/[0.06]">
                {copy.viewCourses} <Icon name="chevron-right" size={15} />
              </Link>
            </div>

            {recentLessons.length > 0 && (
              <div className="grid gap-3">
                {recentLessons.map((lesson) => {
                  const total = sentencesForLesson(state, lesson.id).length;
                  const passed = passedCountForLesson(state, lesson.id);
                  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
                  const last = lastAttemptAtForLesson(state, lesson.id);
                  const lastDate = last
                    ? new Date(last).toLocaleDateString(localeTag, { month: "long", day: "numeric" })
                    : null;
                  const status = lessonStatus(state, lesson.id);
                  return (
                    <Link key={lesson.id} href={href(lessonHref(lesson))} className="card card-interactive group grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                          <span>{status === "completed" ? copy.review : m.common.continue}</span>
                          <span className="tabular-nums">{passed}/{total}{m.common.sentences}</span>
                          {lastDate && <span>{copy.last}: {lastDate}</span>}
                        </div>
                        <p lang="ja" className="truncate text-lg font-bold">{lesson.title}</p>
                        <div className="bar-track mt-2 h-2">
                          <div className="bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-bold transition-colors group-hover:border-primary/35 group-hover:text-primary">
                        {copy.restart}<Icon name="arrow-right" size={15} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* A shelf of real courses, not one featured card: what is on offer
                is the reason to stay on this page. */}
            {recentLessons.length > 0 ? null : featuredCourses.length > 0 ? (
              <div className="stagger grid gap-4 sm:grid-cols-2">
                {featuredCourses.map((course, index) => (
                  <div key={course.id} className="min-w-0" style={{ ["--i" as string]: index }}>
                    <CourseCard
                      course={course}
                      stats={courseStats(state, course.id)}
                      href={courseHref(course)}
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>
            ) : featuredLesson ? (
              <Link href={href(lessonHref(featuredLesson))} className="card card-interactive flex min-h-24 items-center justify-between gap-3 p-5">
                <span lang="ja" className="min-w-0 truncate font-extrabold">{featuredLesson.title}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">{copy.start}<Icon name="arrow-right" size={15} /></span>
              </Link>
            ) : null}
          </section>

          <aside aria-label={m.progress.leaderboardTitle}>
            <LeaderboardPanel currentUserId={profile?.id ?? null} />
          </aside>
        </div>

        <section aria-label={m.progress.climbTitle}>
          <LevelMountain currentLevel={currentLevel} totalXp={totalXp} />
        </section>
      </div>
    </AppShell>
  );
}

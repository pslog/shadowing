"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useData } from "@/lib/store/DataProvider";
import {
  courseBySlug,
  courseStats,
  isAdmin,
  lastAttemptAtForLesson,
  lessonAverageScore,
  lessonHref,
  lessonStatus,
  lessonsForCourse,
  nextLessonInCourse,
  passedCountForLesson,
  sentencesForLesson,
  UNCATEGORIZED_COURSE_ID,
} from "@/lib/store/selectors";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { LessonCard } from "@/components/lesson/LessonCard";
import { N2CourseLessonGrid } from "@/components/lesson/N2CourseLessonGrid";
import { useLessonEngagementStats } from "@/components/lesson/useLessonEngagementStats";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { topicHue } from "@/lib/topic-style";
import { optimizedImageSrc } from "@/lib/optimized-image";
import { isN2Course } from "@/lib/n2-course";
import { useI18n } from "@/components/i18n/useI18n";
import type { AppState } from "@/lib/store/state";
import type { Lesson } from "@/lib/types";

export default function CoursePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, ready } = useData();
  const { dictionary: m, href } = useI18n();

  useEffect(() => {
    if (params.id !== "jlpt-n2-kai") return;
    const query = searchParams.toString();
    router.replace(
      href(`/courses/jlpt-n2-choukai${query ? `?${query}` : ""}${window.location.hash}`),
    );
  }, [href, params.id, router, searchParams]);

  if (!ready) return <FullScreenLoading />;

  const isUncategorized = params.id === UNCATEGORIZED_COURSE_ID;
  const course = courseBySlug(state, params.id);
  // Internal key for lesson queries: the course's real id (or the uncategorized bucket).
  const courseKey = isUncategorized ? UNCATEGORIZED_COURSE_ID : course?.id ?? params.id;

  if (!course && !isUncategorized) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href={href("/courses")} className="text-sm text-muted hover:text-fg">
            {m.courses.backToCourses}
          </Link>
          <h1 className="text-2xl font-bold">{m.courses.notFound}</h1>
        </div>
      </AppShell>
    );
  }

  const lessons = lessonsForCourse(state, courseKey);
  const stats = courseStats(state, courseKey);
  const next = nextLessonInCourse(state, courseKey);
  const title = course?.title ?? m.courses.uncategorizedTitle;
  const description = course?.description ?? null;
  const imageSrc = optimizedImageSrc(course?.image_url);
  const hue = course?.accent ?? topicHue(course?.topic ?? null);
  const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const allDone = stats.total > 0 && stats.completed >= stats.total;
  const showN2Filters =
    isN2Course(course) && lessons.some((lesson) => lesson.media_url?.startsWith("/audio/n2/"));

  return (
    <AppShell>
      <Link href={href("/courses")} className="text-sm text-muted hover:text-fg">
        {m.courses.backToCourses}
      </Link>

      <section className="mt-3 overflow-hidden rounded-[1.35rem] border border-border shadow-[var(--shadow-md)] sm:rounded-[2rem]">
        <div className="flex flex-col md:flex-row">
          {imageSrc ? (
            <div className="relative h-52 w-full shrink-0 bg-white sm:h-56 md:h-auto md:w-64 lg:w-72">
              <Image
                src={imageSrc}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 16rem, 18rem"
                className={
                  showN2Filters
                    ? "object-contain p-2"
                    : "object-contain object-center p-2 md:object-cover md:p-0"
                }
                quality={72}
              />
            </div>
          ) : (
            <div
              className="flex h-32 w-full shrink-0 items-center justify-center md:h-auto md:w-56"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${hue} 30%, transparent), transparent 75%)`,
              }}
            >
              <span
                className="tile-icon h-14 w-14"
                style={{ ["--tile-c" as string]: hue }}
              >
                <Icon name="book" size={26} />
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {course?.topic && <Badge tone="primary">{course.topic}</Badge>}
              {course?.level && <Badge>{course.level}</Badge>}
              <Badge tone={allDone ? "success" : "primary"}>
                {allDone ? m.common.allDone : m.common.inProgress}
              </Badge>
            </div>
            <h1 lang="ja" className="text-[1.45rem] font-extrabold leading-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-muted sm:max-w-3xl">{description}</p>
            )}

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                <span className="tabular-nums text-fg">
                  {stats.completed}/{stats.total} {m.courses.lessonsCompleted}
                </span>
                {stats.averageScore != null && (
                  <span className="tabular-nums text-muted">
                    {m.common.average}{" "}
                    <span className="text-base font-extrabold text-primary">
                      {stats.averageScore}
                    </span>
                    {m.common.scoreSuffix}
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: allDone ? "var(--success)" : hue }}
                />
              </div>
            </div>

            {next && (
              <Link
                href={showN2Filters ? "#n2-filter" : href(lessonHref(next))}
                className={buttonClasses("primary", "md", "mt-4 w-full sm:w-auto")}
              >
                <Icon name={showN2Filters ? "target" : allDone ? "retry" : "arrow-right"} size={16} />
                {showN2Filters
                  ? m.courses.selectCondition
                  : allDone
                  ? m.common.practiceAgain
                  : stats.completed > 0
                    ? m.common.continue
                    : m.courses.startLearning}
                </Link>
            )}
            {course && isAdmin(state) && (
              <Link
                href={href(`/courses/${course.slug ?? course.id}/edit`)}
                className={buttonClasses("secondary", "md", next ? "ml-2 mt-4" : "mt-4")}
              >
                    {m.courses.editCourse}
              </Link>
            )}
          </div>
        </div>
      </section>

      {lessons.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          {m.courses.empty}
        </p>
      ) : showN2Filters ? (
        <N2CourseLessonGrid lessons={lessons} state={state} />
      ) : (
        <CourseLessonCards lessons={lessons} state={state} />
      )}
    </AppShell>
  );
}

function CourseLessonCards({ lessons, state }: { lessons: Lesson[]; state: AppState }) {
  const engagementStats = useLessonEngagementStats(lessons.map((lesson) => lesson.id));

  return (
    <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((l, i) => (
        <div key={l.id} style={{ ["--i" as string]: i }}>
          <LessonCard
            lesson={l}
            status={lessonStatus(state, l.id)}
            passed={passedCountForLesson(state, l.id)}
            total={sentencesForLesson(state, l.id).length}
            lastAttemptAt={lastAttemptAtForLesson(state, l.id)}
            averageScore={lessonAverageScore(state, l.id)}
            engagement={engagementStats[l.id]}
          />
        </div>
      ))}
    </div>
  );
}

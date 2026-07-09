"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import {
  courseById,
  courseStats,
  lastAttemptAtForLesson,
  lessonAverageScore,
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
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { topicHue } from "@/lib/topic-style";

export default function CoursePage() {
  const params = useParams<{ id: string }>();
  const { state, ready } = useData();

  if (!ready) return <FullScreenLoading />;

  const isUncategorized = params.id === UNCATEGORIZED_COURSE_ID;
  const course = courseById(state, params.id);

  if (!course && !isUncategorized) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href="/courses" className="text-sm text-muted hover:text-fg">
            ← コース一覧
          </Link>
          <h1 className="text-2xl font-bold">コースが見つかりません</h1>
        </div>
      </AppShell>
    );
  }

  const lessons = lessonsForCourse(state, params.id);
  const stats = courseStats(state, params.id);
  const next = nextLessonInCourse(state, params.id);
  const title = course?.title ?? "その他のレッスン";
  const description = course?.description ?? null;
  const hue = course?.accent ?? topicHue(course?.topic ?? null);
  const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const allDone = stats.total > 0 && stats.completed >= stats.total;

  return (
    <AppShell>
      <Link href="/courses" className="text-sm text-muted hover:text-fg">
        ← コース一覧
      </Link>

      <section className="mt-3 overflow-hidden rounded-[2rem] border border-border shadow-[var(--shadow-md)]">
        <div className="flex flex-col md:flex-row">
          {course?.image_url ? (
            <div className="relative h-44 w-full shrink-0 sm:h-52 md:h-auto md:w-64 lg:w-72">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={course.image_url}
                alt={title}
                className="h-full w-full object-cover"
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

          <div className="min-w-0 flex-1 p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {course?.topic && <Badge tone="primary">{course.topic}</Badge>}
              {course?.level && <Badge>{course.level}</Badge>}
              <Badge tone={allDone ? "success" : "primary"}>
                {allDone ? "全完了" : "学習中"}
              </Badge>
            </div>
            <h1 lang="ja" className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            )}

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                <span className="tabular-nums text-fg">
                  {stats.completed}/{stats.total} レッスン完了
                </span>
                {stats.averageScore != null && (
                  <span className="tabular-nums text-muted">
                    平均{" "}
                    <span className="text-base font-extrabold text-primary">
                      {stats.averageScore}
                    </span>
                    点
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
                href={`/lessons/${next.id}`}
                className={buttonClasses("primary", "md", "mt-4")}
              >
                <Icon name={allDone ? "retry" : "arrow-right"} size={16} />
                {allDone
                  ? "もう一度練習"
                  : stats.completed > 0
                    ? "続きから"
                    : "学習を始める"}
              </Link>
            )}
          </div>
        </div>
      </section>

      {lessons.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          このコースにはまだレッスンがありません。
        </p>
      ) : (
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
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

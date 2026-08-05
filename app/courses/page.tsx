"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  courseHref,
  courseStats,
  isAdmin,
  lessonsForCourse,
  uncategorizedLessons,
  visibleCourses,
  UNCATEGORIZED_COURSE_ID,
} from "@/lib/store/selectors";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { CourseCard } from "@/components/lesson/CourseCard";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Course } from "@/lib/types";
import { useLessonEngagementStats } from "@/components/lesson/useLessonEngagementStats";

export default function CoursesPage() {
  const { state, ready } = useData();

  const courses = visibleCourses(state);
  const ungrouped = uncategorizedLessons(state);
  const lessonIdsByCourse = Object.fromEntries(
    courses.map((course) => [
      course.id,
      lessonsForCourse(state, course.id).map((lesson) => lesson.id),
    ]),
  );
  const courseLessonIds = Object.values(lessonIdsByCourse).flat();
  const ungroupedLessonIds = ungrouped.map((lesson) => lesson.id);
  const engagementStats = useLessonEngagementStats(
    [...courseLessonIds, ...ungroupedLessonIds],
    ready,
  );

  const engagementForLessonIds = (lessonIds: string[]) =>
    lessonIds.reduce(
      (acc, lessonId) => {
        const stats = engagementStats[lessonId];
        acc.totalViews += stats?.totalViews ?? 0;
        acc.shadowingUsers += stats?.shadowingUsers ?? 0;
        return acc;
      },
      { totalViews: 0, shadowingUsers: 0 },
    );

  if (!ready) return <FullScreenLoading />;

  // Show the "その他" bucket as a pseudo-course when there are ungrouped lessons.
  const uncategorized: Course | null =
    ungrouped.length > 0
      ? {
          id: UNCATEGORIZED_COURSE_ID,
          user_id: "",
          slug: null,
          title: "その他のレッスン",
          description: "コースに属さないレッスン。",
          topic: null,
          level: null,
          accent: "#64748b",
          image_url: null,
          order_index: 999,
          is_public: true,
          created_at: "",
        }
      : null;

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">コース</h1>
          <p className="text-muted">
            コースを選んで、関連するレッスンを順番に練習しましょう。
          </p>
        </div>
        {isAdmin(state) && (
          <Link href="/courses/new" className={buttonClasses("primary")}>
            <Icon name="plus" size={16} />
            コース作成
          </Link>
        )}
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-2">
        {courses.map((c, i) => (
          <div key={c.id} style={{ ["--i" as string]: i }}>
            <CourseCard
              course={c}
              stats={courseStats(state, c.id)}
              engagement={engagementForLessonIds(lessonIdsByCourse[c.id] ?? [])}
              href={courseHref(c)}
            />
          </div>
        ))}
        {uncategorized && (
          <div style={{ ["--i" as string]: courses.length }}>
            <CourseCard
              course={uncategorized}
              stats={courseStats(state, UNCATEGORIZED_COURSE_ID)}
              engagement={engagementForLessonIds(ungroupedLessonIds)}
              href={`/courses/${UNCATEGORIZED_COURSE_ID}`}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

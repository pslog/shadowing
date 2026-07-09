"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  courseStats,
  isAdmin,
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

export default function CoursesPage() {
  const { state, ready } = useData();

  if (!ready) return <FullScreenLoading />;

  const courses = visibleCourses(state);
  const ungrouped = uncategorizedLessons(state);

  // Show the "その他" bucket as a pseudo-course when there are ungrouped lessons.
  const uncategorized: Course | null =
    ungrouped.length > 0
      ? {
          id: UNCATEGORIZED_COURSE_ID,
          user_id: "",
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
              href={`/courses/${c.id}`}
            />
          </div>
        ))}
        {uncategorized && (
          <div style={{ ["--i" as string]: courses.length }}>
            <CourseCard
              course={uncategorized}
              stats={courseStats(state, UNCATEGORIZED_COURSE_ID)}
              href={`/courses/${UNCATEGORIZED_COURSE_ID}`}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/lib/store/DataProvider";
import {
  courseHref,
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
import { useCourseEngagementStats } from "@/components/lesson/useCourseEngagementStats";
import { useI18n } from "@/components/i18n/useI18n";

export default function CoursesPage() {
  const { state, ready } = useData();
  const { dictionary: m, href, locale } = useI18n();
  const [query, setQuery] = useState("");

  const courses = visibleCourses(state);
  const filtered = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim();
    const needle = normalize(query);
    return courses.filter((course) => normalize(
      [course.title, course.description, course.level, course.topic].filter(Boolean).join(" "),
    ).includes(needle));
  }, [courses, query]);
  const ungrouped = uncategorizedLessons(state);
  const engagementStats = useCourseEngagementStats(ready);

  if (!ready) return <FullScreenLoading />;

  // Show the "その他" bucket as a pseudo-course when there are ungrouped lessons.
  const uncategorized: Course | null =
    ungrouped.length > 0
      ? {
          id: UNCATEGORIZED_COURSE_ID,
          user_id: "",
          slug: null,
          title: m.courses.uncategorizedTitle,
          description: m.courses.uncategorizedDescription,
          topic: null,
          level: null,
          accent: "#5f7da3",
          image_url: null,
          order_index: 999,
          is_public: true,
          created_at: "",
        }
      : null;

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p lang="ja" className="text-xs font-bold tracking-[0.08em] text-accent">学習コース</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">{m.courses.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {m.courses.subtitle}
          </p>
        </div>
        {isAdmin(state) && (
          <Link href={href("/courses/new")} className={buttonClasses("primary")}>
            <Icon name="plus" size={16} />
            {m.courses.create}
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-lg">
          <label htmlFor="course-search" className="mb-2 block text-sm font-semibold">
            {locale === "vi" ? "Tìm khóa học" : "コースを検索"}
          </label>
          <input
            id="course-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={locale === "vi" ? "Tên khóa học, chủ đề hoặc trình độ…" : "コース名・トピック・レベル…"}
            className="min-h-12 w-full rounded-xl border border-border bg-card px-4 text-base"
          />
        </div>
        <p role="status" className="text-sm text-muted">
          {locale === "vi" ? `${filtered.length} khóa học` : `${filtered.length}コース`}
        </p>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-bold">{locale === "vi" ? "Không tìm thấy khóa học phù hợp" : "該当するコースがありません"}</p>
          <button type="button" onClick={() => setQuery("")} className={buttonClasses("outline", "md", "mt-4")}>
            {locale === "vi" ? "Xóa tìm kiếm" : "検索をクリア"}
          </button>
        </div>
      )}
      <div className="stagger grid gap-4 lg:grid-cols-2">
        {filtered.map((c, i) => (
          <div key={c.id} style={{ ["--i" as string]: i }}>
            <CourseCard
              course={c}
              stats={courseStats(state, c.id)}
              engagement={engagementStats[c.id]}
              href={courseHref(c)}
              priority={i === 0}
            />
          </div>
        ))}
        {uncategorized && !query.trim() && (
          <div style={{ ["--i" as string]: courses.length }}>
            <CourseCard
              course={uncategorized}
              stats={courseStats(state, UNCATEGORIZED_COURSE_ID)}
              engagement={engagementStats.__uncategorized__}
              href={href(`/courses/${UNCATEGORIZED_COURSE_ID}`)}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

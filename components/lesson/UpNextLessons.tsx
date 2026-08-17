"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { useData } from "@/lib/store/DataProvider";
import {
  courseById,
  lessonHref,
  lessonStatus,
  lessonsForCourse,
  passedCountForLesson,
  sentencesForLesson,
  visibleLessons,
  UNCATEGORIZED_COURSE_ID,
} from "@/lib/store/selectors";
import { lessonHue } from "@/lib/topic-style";
import { useI18n } from "@/components/i18n/useI18n";
import type { Lesson } from "@/lib/types";

// Two rows of three on a wide screen; the grid reflows to one column on phones.
const SUGGESTION_COUNT = 6;

/**
 * Status of a lesson the learner is NOT currently in.
 *
 * `lessonStatus` counts sentences, and sentences are fetched lazily for the open
 * lesson only — so for every other lesson it counts zero and can never report
 * "completed". The saved progress row knows, and is loaded for the whole
 * account, so it is the authority here.
 */
function savedStatus(
  state: ReturnType<typeof useData>["state"],
  lessonId: string,
): "not_started" | "in_progress" | "completed" {
  const row = state.progress.find(
    (item) => item.user_id === state.profile?.id && item.lesson_id === lessonId,
  );
  if (row) return row.status === "completed" ? "completed" : "in_progress";
  return lessonStatus(state, lessonId);
}

/**
 * "What now?" at the end of a lesson.
 *
 * Finishing a lesson used to leave one exit — back to the course list — which
 * puts a directory between the learner and the next thing they were going to do
 * anyway. This proposes the actual next lessons, in reading order, so continuing
 * is one tap.
 *
 * Order of candidates is the point: the lessons AFTER this one in the same
 * course come first (that is the author's intended sequence), then anything
 * still unfinished earlier in the course (skipped or half-done), and only then
 * lessons from elsewhere — the last group is what keeps the strip useful on the
 * final lesson of a course instead of showing an empty state.
 */
export function UpNextLessons({ lesson }: { lesson: Lesson }) {
  const { state } = useData();
  const { dictionary: m, href } = useI18n();
  const t = m.upNext;

  const courseId = lesson.course_id ?? UNCATEGORIZED_COURSE_ID;
  const siblings = lessonsForCourse(state, courseId);
  const index = siblings.findIndex((item) => item.id === lesson.id);

  const after = index >= 0 ? siblings.slice(index + 1) : siblings;
  const unfinishedBefore =
    index > 0
      ? siblings
          .slice(0, index)
          .filter((item) => savedStatus(state, item.id) !== "completed")
      : [];
  const elsewhere = visibleLessons(state).filter(
    (item) =>
      item.id !== lesson.id &&
      item.course_id !== lesson.course_id &&
      savedStatus(state, item.id) === "not_started",
  );

  const picked: Lesson[] = [];
  const seen = new Set<string>([lesson.id]);
  for (const candidate of [...after, ...unfinishedBefore, ...elsewhere]) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picked.push(candidate);
    if (picked.length >= SUGGESTION_COUNT) break;
  }


  if (picked.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-border bg-card p-5 text-center">
        <p className="text-sm font-semibold text-fg">{t.allDone}</p>
        <Link href={href("/courses")} className={`${buttonClasses("primary", "sm")} mt-3`}>
          {t.browseAll}
          <Icon name="arrow-right" size={15} />
        </Link>
      </section>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {picked.map((item) => (
        <li key={item.id}>
          <SuggestionRow lesson={item} currentCourseId={lesson.course_id} />
        </li>
      ))}
    </ul>
  );
}

function SuggestionRow({
  lesson,
  currentCourseId,
}: {
  lesson: Lesson;
  /** Course of the open lesson, so only lessons from ELSEWHERE get named. */
  currentCourseId: string | null;
}) {
  const { state } = useData();
  const { dictionary: m, href } = useI18n();
  const progress = state.progress.find(
    (item) => item.user_id === state.profile?.id && item.lesson_id === lesson.id,
  );
  const status = savedStatus(state, lesson.id);
  const loadedTotal = sentencesForLesson(state, lesson.id).length;
  const total = loadedTotal || progress?.total_sentence_count || 0;
  const passed = progress?.passed_sentence_count ?? passedCountForLesson(state, lesson.id);
  const course =
    lesson.course_id && lesson.course_id !== currentCourseId
      ? courseById(state, lesson.course_id)
      : undefined;
  const hue = lessonHue(lesson.topic, lesson.title);

  return (
    <Link
      href={href(lessonHref(lesson))}
      className="focus-ring group flex h-full items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 transition-colors hover:border-primary/40 hover:bg-surface"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{
          background: `color-mix(in srgb, ${hue} 16%, transparent)`,
          color: hue,
        }}
      >
        <Icon name={lesson.topic === "読解" ? "book" : "mic"} size={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          lang="ja"
          className="block truncate text-sm font-extrabold text-fg transition-colors group-hover:text-primary"
        >
          {lesson.title}
        </span>
        {course && (
          <span className="block truncate text-[11px] font-bold text-muted">
            {course.title}
          </span>
        )}
      </span>

      {total > 0 && (
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted">
          {status === "not_started" ? `${total}${m.common.sentences}` : `${passed}/${total}`}
        </span>
      )}
      {status === "completed" && (
        <Icon name="check" size={14} className="shrink-0 text-[var(--success)]" />
      )}
      <Icon
        name="arrow-right"
        size={15}
        className="shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}

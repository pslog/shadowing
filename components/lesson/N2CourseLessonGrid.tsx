"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LessonCard } from "@/components/lesson/LessonCard";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { N2_MONDAI_LABELS, n2LessonMeta } from "@/lib/n2-course";
import { useData } from "@/lib/store/DataProvider";
import {
  lastAttemptAtForLesson,
  lessonAverageScore,
  lessonHref,
  lessonStatus,
  passedCountForLesson,
  sentencesForLesson,
} from "@/lib/store/selectors";
import type { AppState } from "@/lib/store/state";
import type { Lesson } from "@/lib/types";

function examToParam(exam: string): string {
  const [year, month] = exam.split("/");
  return `${year}-${month.padStart(2, "0")}`;
}

function paramToExam(value: string | null): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return `${match[1]}/${Number(match[2])}`;
}

function n2Sort(a: Lesson, b: Lesson): number {
  const am = n2LessonMeta(a);
  const bm = n2LessonMeta(b);
  if (am && bm) {
    return (
      Number(am.year) - Number(bm.year) ||
      Number(am.month) - Number(bm.month) ||
      Number(am.mondai) - Number(bm.mondai) ||
      am.question - bm.question
    );
  }
  if (am) return -1;
  if (bm) return 1;
  return a.title.localeCompare(b.title);
}

function countBy(items: Lesson[], keyOf: (lesson: Lesson) => string | null) {
  const out = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function FilterChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "focus-ring inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-bold transition-all active:scale-[0.98]",
        active
          ? "border-primary bg-primary text-primary-fg shadow-[var(--shadow-glow)]"
          : "border-border bg-surface text-fg hover:border-primary/40 hover:bg-card",
      ].join(" ")}
    >
      <span>{label}</span>
      {count != null && (
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs tabular-nums",
            active
              ? "bg-white/20 text-primary-fg"
              : "bg-[color-mix(in_srgb,var(--muted)_12%,transparent)] text-muted",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function N2CourseLessonGrid({
  lessons,
  state,
}: {
  lessons: Lesson[];
  state: AppState;
}) {
  const { ensureLessonSentences, usingSupabase } = useData();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAllExams, setShowAllExams] = useState(false);
  const sortedLessons = useMemo(() => [...lessons].sort(n2Sort), [lessons]);
  const mondaiCounts = useMemo(
    () => countBy(sortedLessons, (lesson) => n2LessonMeta(lesson)?.mondai ?? null),
    [sortedLessons],
  );
  const examCounts = useMemo(
    () => countBy(sortedLessons, (lesson) => n2LessonMeta(lesson)?.exam ?? null),
    [sortedLessons],
  );
  const exams = useMemo(
    () =>
      [...examCounts.keys()].sort((a, b) => {
        const [ay, am] = a.split("/").map(Number);
        const [by, bm] = b.split("/").map(Number);
        return ay - by || am - bm;
      }),
    [examCounts],
  );

  const queryMondai = searchParams.get("mondai");
  const queryExam = paramToExam(searchParams.get("exam"));
  const mondai =
    queryMondai && Object.hasOwn(N2_MONDAI_LABELS, queryMondai) ? queryMondai : null;
  const exam = queryExam && exams.includes(queryExam) ? queryExam : null;
  const readyToShow = mondai != null && exam != null;
  const filteredLessons = readyToShow
    ? sortedLessons.filter((lesson) => {
        const meta = n2LessonMeta(lesson);
        return meta?.mondai === mondai && meta.exam === exam;
      })
    : [];
  const selectedMondaiLabel = mondai ? N2_MONDAI_LABELS[mondai] : "未選択";
  const selectedExamLabel = exam ?? "未選択";
  const visibleExams = useMemo(() => {
    if (showAllExams) return exams;
    return [...new Set([...(exam ? [exam] : []), ...exams])].slice(0, 8);
  }, [exam, exams, showAllExams]);
  const hiddenExamCount = Math.max(0, exams.length - visibleExams.length);

  function updateFilter(nextMondai: string | null, nextExam: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMondai) params.set("mondai", nextMondai);
    else params.delete("mondai");
    if (nextExam) params.set("exam", examToParam(nextExam));
    else params.delete("exam");
    const query = params.toString();
    window.history.pushState(null, "", `${pathname}${query ? `?${query}` : ""}#n2-filter`);
  }

  const lessonFilterQuery = readyToShow
    ? `?fromMondai=${mondai}&fromExam=${examToParam(exam)}`
    : "";

  useEffect(() => {
    if (!usingSupabase || filteredLessons.length === 0) return;
    void ensureLessonSentences(filteredLessons.map((lesson) => lesson.id));
  }, [ensureLessonSentences, filteredLessons, usingSupabase]);

  useEffect(() => {
    setShowAllExams(false);
  }, [mondai]);

  return (
    <section id="n2-filter" className="mt-5 scroll-mt-24 space-y-4 sm:mt-6">
      <div className="overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-[var(--shadow-md)] sm:rounded-2xl">
        <div className="border-b border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_14%,transparent),color-mix(in_srgb,var(--accent)_9%,transparent))] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="tile-icon h-9 w-9 shrink-0 sm:h-8 sm:w-8"
                style={{ ["--tile-c" as string]: "var(--primary)" }}
              >
                <Icon name="target" size={15} />
              </span>
              <h2 className="text-lg font-extrabold leading-tight sm:text-base">練習範囲</h2>
              <span className="w-full text-sm leading-snug text-muted sm:w-auto">
                {readyToShow
                  ? `${selectedMondaiLabel} / ${selectedExamLabel}`
                  : "問題形式と受験年月を選択"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge tone={readyToShow ? "success" : "warning"}>
                {readyToShow
                  ? `表示中 ${filteredLessons.length}/${sortedLessons.length} レッスン`
                  : `${sortedLessons.length} レッスンから選択`}
              </Badge>
              {(mondai || exam) && (
                <button
                  type="button"
                  onClick={() => updateFilter(null, null)}
                  className="focus-ring inline-flex min-h-10 touch-manipulation items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-bold text-muted transition hover:border-primary/40 hover:text-fg active:scale-[0.98]"
                >
                  選択を解除
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5">
          <div className="rounded-2xl border border-border/70 bg-surface/55 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">問題形式</h3>
              <span className="text-xs font-bold text-muted">必須</span>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Object.keys(N2_MONDAI_LABELS).map((key) => (
                <FilterChip
                  key={key}
                  active={mondai === key}
                  count={mondaiCounts.get(key) ?? 0}
                  label={N2_MONDAI_LABELS[key]}
                  onClick={() => updateFilter(key, exam)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/55 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">受験年月</h3>
              <span className="text-xs font-bold text-muted">必須</span>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleExams.map((key) => (
                <FilterChip
                  key={key}
                  active={exam === key}
                  count={examCounts.get(key) ?? 0}
                  label={key}
                  onClick={() => updateFilter(mondai, key)}
                />
              ))}
              {hiddenExamCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllExams(true)}
                  className="focus-ring inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-dashed border-primary/35 bg-card px-3 text-sm font-extrabold text-primary transition hover:bg-primary/8 active:scale-[0.98]"
                >
                  +{hiddenExamCount}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {!readyToShow ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center sm:p-8">
          <span
            className="tile-icon mx-auto h-12 w-12"
            style={{ ["--tile-c" as string]: "var(--accent)" }}
          >
            <Icon name="book" size={22} />
          </span>
          <p className="mt-3 font-extrabold text-fg">まだレッスンは表示していません。</p>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-muted">
            上の「問題形式」と「受験年月」を両方選択してください。選択後、この場所に該当するレッスン一覧が表示されます。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-muted">
            <span className="rounded-full border border-border bg-card px-3 py-1">
              例: 問題1 課題理解
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1">
              例: 2012/12
            </span>
          </div>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-bold text-fg">該当するレッスンがありません。</p>
          <p className="mt-1 text-sm text-muted">
            問題形式または受験年月を変更してください。
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filteredLessons.map((lesson, i) => (
            <div key={lesson.id} style={{ ["--i" as string]: i }}>
              <LessonCard
                lesson={lesson}
                status={lessonStatus(state, lesson.id)}
                passed={passedCountForLesson(state, lesson.id)}
                total={sentencesForLesson(state, lesson.id).length}
                lastAttemptAt={lastAttemptAtForLesson(state, lesson.id)}
                averageScore={lessonAverageScore(state, lesson.id)}
                href={`${lessonHref(lesson)}${lessonFilterQuery}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

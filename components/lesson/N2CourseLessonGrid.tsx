"use client";

import { useMemo, useState } from "react";
import { LessonCard } from "@/components/lesson/LessonCard";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { N2_MONDAI_LABELS, n2LessonMeta } from "@/lib/n2-course";
import {
  lastAttemptAtForLesson,
  lessonAverageScore,
  lessonStatus,
  passedCountForLesson,
  sentencesForLesson,
} from "@/lib/store/selectors";
import type { AppState } from "@/lib/store/state";
import type { Lesson } from "@/lib/types";

type FilterValue = "all" | string;

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
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-all",
        active
          ? "border-primary bg-primary text-primary-fg shadow-[var(--shadow-glow)]"
          : "border-border bg-surface text-fg hover:border-primary/40 hover:bg-card",
      ].join(" ")}
    >
      {label}
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
  const [mondai, setMondai] = useState<FilterValue | null>(null);
  const [exam, setExam] = useState<FilterValue | null>(null);

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
  const selectedExam = exam;
  const readyToShow = mondai != null && selectedExam != null;

  const filteredLessons = readyToShow
    ? sortedLessons.filter((lesson) => {
        const meta = n2LessonMeta(lesson);
        if (!meta) return false;
        return meta.mondai === mondai && meta.exam === selectedExam;
      })
    : [];

  const hasCustomFilter = mondai != null || selectedExam != null;

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="tile-icon h-9 w-9"
                style={{ ["--tile-c" as string]: "var(--primary)" }}
              >
                <Icon name="target" size={17} />
              </span>
              <h2 className="text-lg font-extrabold">N2聴解フィルター</h2>
              <Badge tone="primary">
                {readyToShow
                  ? `表示中 ${filteredLessons.length}/${sortedLessons.length} レッスン`
                  : `${sortedLessons.length} レッスン`}
              </Badge>
            </div>
            <p className="text-sm text-muted">
              問題形式と受験年月を選択すると、該当するレッスンだけを表示します。
            </p>
          </div>

          {hasCustomFilter && (
            <button
              type="button"
              onClick={() => {
                setMondai(null);
                setExam(null);
              }}
              className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-bold text-muted transition hover:border-primary/40 hover:text-fg"
            >
              選択を解除
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <div className="mb-2 text-xs font-bold uppercase text-muted">
              問題形式
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(N2_MONDAI_LABELS).map((key) => (
                <FilterChip
                  key={key}
                  active={mondai === key}
                  count={mondaiCounts.get(key) ?? 0}
                  label={N2_MONDAI_LABELS[key]}
                  onClick={() => setMondai(key)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase text-muted">
              受験年月
            </div>
            <div className="flex flex-wrap gap-2">
              {exams.map((key) => (
                <FilterChip
                  key={key}
                  active={selectedExam === key}
                  count={examCounts.get(key) ?? 0}
                  label={key}
                  onClick={() => setExam(key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {!readyToShow ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-bold text-fg">問題形式と受験年月を選択してください。</p>
          <p className="mt-1 text-sm text-muted">
            両方を選ぶと、対象のレッスン一覧がここに表示されます。
          </p>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-bold text-fg">該当するレッスンがありません。</p>
          <p className="mt-1 text-sm text-muted">
            問題形式または受験年月を変更してください。
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLessons.map((lesson, i) => (
            <div key={lesson.id} style={{ ["--i" as string]: i }}>
              <LessonCard
                lesson={lesson}
                status={lessonStatus(state, lesson.id)}
                passed={passedCountForLesson(state, lesson.id)}
                total={sentencesForLesson(state, lesson.id).length}
                lastAttemptAt={lastAttemptAtForLesson(state, lesson.id)}
                averageScore={lessonAverageScore(state, lesson.id)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

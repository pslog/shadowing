"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { lessonHue } from "@/lib/topic-style";
import { lessonHref } from "@/lib/store/selectors";
import { useI18n } from "@/components/i18n/useI18n";
import type { Lesson, LessonStatus } from "@/lib/types";
import type { LessonEngagementStats } from "./useLessonEngagementStats";

const STATUS_TONE: Record<LessonStatus, "neutral" | "primary" | "success"> = {
  not_started: "neutral",
  in_progress: "primary",
  completed: "success",
};

export function LessonCard({
  lesson,
  status,
  passed,
  total,
  lastAttemptAt,
  averageScore,
  engagement,
  href,
}: {
  lesson: Lesson;
  status: LessonStatus;
  passed: number;
  total: number;
  lastAttemptAt?: string | null;
  averageScore?: number | null;
  engagement?: LessonEngagementStats;
  href?: string;
}) {
  const { dictionary: m, href: localizedHref } = useI18n();
  const statusLabel =
    status === "not_started"
      ? m.common.notStarted
      : status === "completed"
        ? m.common.completed
        : m.common.inProgress;
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const hue = lessonHue(lesson.topic, lesson.title);
  const completed = status === "completed";
  const d = lastAttemptAt ? new Date(lastAttemptAt) : null;
  const lastPracticed = d ? `${d.getMonth() + 1}/${d.getDate()}` : null;
  const totalViews = engagement?.totalViews ?? 0;
  const shadowingUsers = engagement?.shadowingUsers ?? 0;
  const scoreTone =
    averageScore == null
      ? null
      : averageScore >= 80
        ? "var(--success)"
        : "var(--warning)";

  return (
    <div
      className={[
        "card card-interactive flex flex-col gap-2.5 overflow-hidden p-0",
        completed ? "ring-2 ring-[var(--success)]/40" : "",
      ].join(" ")}
      style={{ ["--tile-c" as string]: completed ? "var(--success)" : hue }}
    >
      <div
        className="relative px-4 pb-3.5 pt-4 sm:px-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${
            completed ? "var(--success)" : hue
          } 18%, transparent), transparent 72%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            lang="ja"
            className="min-w-0 flex-1 text-[1rem] font-extrabold leading-snug sm:text-base"
          >
            {lesson.title}
          </h3>
          <Badge tone={STATUS_TONE[status]}>{statusLabel}</Badge>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {lesson.topic && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: hue }}
              >
                {lesson.topic}
              </span>
            )}
            {lesson.level && <Badge>{lesson.level}</Badge>}
          </div>

          <div
            className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/85 px-2.5 text-[11px] font-extrabold text-muted shadow-sm backdrop-blur"
            aria-label={`${totalViews} ${m.common.views}, ${shadowingUsers} ${m.common.shadowingUsers}`}
          >
            <span className="inline-flex items-center gap-1 tabular-nums" title={m.common.views}>
              <Icon name="eye" size={12} />
              {totalViews.toLocaleString()}
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={m.common.shadowingUsers}
            >
              <Icon name="users" size={12} />
              {shadowingUsers.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-fg tabular-nums">
              {passed}/{total}
              {m.common.sentences}
            </span>
            {averageScore != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tabular-nums text-white"
                style={{ background: scoreTone ?? "var(--muted)" }}
              >
                <Icon name="star" size={11} filled />
                {m.lessonCard.averagePrefix}{averageScore}{m.common.scoreSuffix}
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: completed ? "var(--success)" : hue }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            {Math.round(pct)}% {m.lessonCard.percentCompleted}
            {lesson.duration_seconds
              ? ` · ${Math.round(lesson.duration_seconds / 60)}${m.common.minuteApprox}`
              : ""}
            {lastPracticed ? ` · ${m.common.last} ${lastPracticed}` : ""}
          </p>
        </div>

        <Link
          href={localizedHref(href ?? lessonHref(lesson))}
          prefetch={false}
          className={buttonClasses(
            status === "completed" ? "secondary" : "primary",
            "md",
            "mt-auto min-h-11 w-full sm:w-auto",
          )}
        >
          {status === "not_started"
            ? m.common.start
            : status === "completed"
              ? m.common.practiceAgain
              : m.common.continue}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}

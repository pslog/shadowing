import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { lessonHue } from "@/lib/topic-style";
import { lessonHref } from "@/lib/store/selectors";
import type { Lesson, LessonStatus } from "@/lib/types";

const STATUS: Record<
  LessonStatus,
  { label: string; tone: "neutral" | "primary" | "success" }
> = {
  not_started: { label: "未学習", tone: "neutral" },
  in_progress: { label: "学習中", tone: "primary" },
  completed: { label: "完了", tone: "success" },
};

export function LessonCard({
  lesson,
  status,
  passed,
  total,
  lastAttemptAt,
  averageScore,
}: {
  lesson: Lesson;
  status: LessonStatus;
  passed: number;
  total: number;
  lastAttemptAt?: string | null;
  averageScore?: number | null;
}) {
  const s = STATUS[status];
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const hue = lessonHue(lesson.topic, lesson.title);
  const completed = status === "completed";
  const d = lastAttemptAt ? new Date(lastAttemptAt) : null;
  const lastPracticed = d ? `${d.getMonth() + 1}月${d.getDate()}日` : null;
  const scoreTone =
    averageScore == null
      ? null
      : averageScore >= 80
        ? "var(--success)"
        : "var(--warning)";

  return (
    <div
      className={[
        "card card-interactive flex flex-col gap-3 overflow-hidden p-0",
        completed ? "ring-2 ring-[var(--success)]/40" : "",
      ].join(" ")}
      style={{ ["--tile-c" as string]: completed ? "var(--success)" : hue }}
    >
      <div
        className="relative px-5 pb-4 pt-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${
            completed ? "var(--success)" : hue
          } 22%, transparent), transparent 70%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="tile-icon h-10 w-10 shrink-0"
            style={{ ["--tile-c" as string]: completed ? "var(--success)" : hue }}
          >
            <Icon name={completed ? "trophy" : "book"} size={20} />
          </span>
          <Badge tone={s.tone}>
            {completed && <Icon name="check" size={12} strokeWidth={2.5} />}
            {s.label}
          </Badge>
        </div>
        <h3 lang="ja" className="mt-3 line-clamp-2 text-base font-bold leading-snug">
          {lesson.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {lesson.topic && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
              style={{ background: hue }}
            >
              {lesson.topic}
            </span>
          )}
          {lesson.level && <Badge>{lesson.level}</Badge>}
          {lesson.is_public && <Badge>公式</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-fg tabular-nums">
              {passed}/{total} 文
            </span>
            {averageScore != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tabular-nums text-white"
                style={{ background: scoreTone ?? "var(--muted)" }}
              >
                <Icon name="star" size={11} filled />
                平均 {averageScore}点
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
            {Math.round(pct)}% 完了
            {lesson.duration_seconds
              ? ` · 約${Math.round(lesson.duration_seconds / 60)}分`
              : ""}
            {lastPracticed ? ` · 最終 ${lastPracticed}` : ""}
          </p>
        </div>

        <Link
          href={lessonHref(lesson)}
          className={buttonClasses(
            status === "completed" ? "secondary" : "primary",
            "md",
            "mt-auto",
          )}
        >
          {status === "not_started"
            ? "開始"
            : status === "completed"
              ? "もう一度練習"
              : "続きから"}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}

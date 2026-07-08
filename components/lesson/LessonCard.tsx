import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { topicHue } from "@/lib/topic-style";
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
}: {
  lesson: Lesson;
  status: LessonStatus;
  passed: number;
  total: number;
  lastAttemptAt?: string | null;
}) {
  const s = STATUS[status];
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const hue = topicHue(lesson.topic);
  const lastPracticed = lastAttemptAt
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
      }).format(new Date(lastAttemptAt))
    : null;

  return (
    <div
      className="card card-interactive flex flex-col gap-3 overflow-hidden p-0"
      style={{ ["--tile-c" as string]: hue }}
    >
      <div
        className="relative px-5 pb-4 pt-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${hue} 22%, transparent), transparent 70%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="tile-icon h-10 w-10 shrink-0"
            style={{ ["--tile-c" as string]: hue }}
          >
            <Icon name="book" size={20} />
          </span>
          <Badge tone={s.tone}>{s.label}</Badge>
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
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-fg tabular-nums">
              {passed}/{total} 文
            </span>
            <span className="text-muted">
              {lastPracticed ? `最後: ${lastPracticed}` : "未練習"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: hue }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            {Math.round(pct)}% 完了
            {lesson.duration_seconds
              ? ` · 約${Math.round(lesson.duration_seconds / 60)}分`
              : ""}
          </p>
        </div>

        <Link
          href={`/lessons/${lesson.id}`}
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

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { topicHue } from "@/lib/topic-style";
import type { Course } from "@/lib/types";
import type { CourseStats } from "@/lib/store/selectors";

export function CourseCard({
  course,
  stats,
  href,
}: {
  course: Course;
  stats: CourseStats;
  href: string;
}) {
  const hue = course.accent ?? topicHue(course.topic);
  const done = stats.total > 0 && stats.completed >= stats.total;
  const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const scoreTone =
    stats.averageScore == null
      ? null
      : stats.averageScore >= 80
        ? "var(--success)"
        : "var(--warning)";

  return (
    <Link
      href={href}
      className={[
        "card card-interactive group grid min-h-36 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4",
        done ? "ring-2 ring-[var(--success)]/35" : "",
      ].join(" ")}
      style={{ ["--tile-c" as string]: done ? "var(--success)" : hue }}
    >
      <div
        className="relative h-full min-h-32 overflow-hidden rounded-2xl border border-border bg-surface"
        style={
          course.image_url
            ? undefined
            : {
                background: `linear-gradient(145deg, color-mix(in srgb, ${
                  done ? "var(--success)" : hue
                } 22%, transparent), var(--surface))`,
              }
        }
      >
        {course.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.image_url}
              alt=""
              className="h-full w-full object-cover object-top"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span
              className="tile-icon h-11 w-11"
              style={{ ["--tile-c" as string]: done ? "var(--success)" : hue }}
            >
              <Icon name={done ? "trophy" : "book"} size={22} />
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col py-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {course.level && <Badge>{course.level}</Badge>}
          <Badge tone={done ? "success" : "primary"}>
            {done ? "全完了" : `${stats.total}レッスン`}
          </Badge>
          {stats.averageScore != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
              style={{ background: scoreTone ?? "var(--muted)" }}
            >
              <Icon name="star" size={11} filled />
              平均 {stats.averageScore}点
            </span>
          )}
        </div>

        <h3 lang="ja" className="mt-2 line-clamp-2 text-base font-extrabold leading-snug sm:text-lg">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
            {course.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-fg tabular-nums">
              {stats.completed}/{stats.total} 完了
            </span>
            <span className="font-semibold text-muted tabular-nums">
              {Math.round(pct)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_18%,transparent)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: done ? "var(--success)" : hue }}
            />
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
            開く
            <Icon
              name="arrow-right"
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

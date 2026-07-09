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
        "card card-interactive flex flex-col gap-3 overflow-hidden p-0",
        done ? "ring-2 ring-[var(--success)]/40" : "",
      ].join(" ")}
      style={{ ["--tile-c" as string]: done ? "var(--success)" : hue }}
    >
      {course.image_url && (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.image_url}
            alt=""
            className="h-full w-full object-cover object-top"
          />
          {/* gradient scrim so overlaid badges stay readable */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
            {course.level && <Badge>{course.level}</Badge>}
            <Badge tone={done ? "success" : "primary"}>
              {done ? "全完了" : `${stats.total}レッスン`}
            </Badge>
          </div>
        </div>
      )}
      <div
        className="relative px-5 pb-4 pt-5"
        style={
          course.image_url
            ? undefined
            : {
                background: `linear-gradient(135deg, color-mix(in srgb, ${
                  done ? "var(--success)" : hue
                } 26%, transparent), transparent 72%)`,
              }
        }
      >
        {!course.image_url && (
          <div className="flex items-start justify-between gap-3">
            <span
              className="tile-icon h-11 w-11 shrink-0"
              style={{ ["--tile-c" as string]: done ? "var(--success)" : hue }}
            >
              <Icon name={done ? "trophy" : "book"} size={22} />
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {course.level && <Badge>{course.level}</Badge>}
              <Badge tone={done ? "success" : "primary"}>
                {done ? "全完了" : `${stats.total}レッスン`}
              </Badge>
            </div>
          </div>
        )}
        <h3
          lang="ja"
          className={[
            "line-clamp-2 text-lg font-extrabold leading-snug",
            course.image_url ? "" : "mt-3",
          ].join(" ")}
        >
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {course.description}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-fg tabular-nums">
            {stats.completed}/{stats.total} 完了
          </span>
          {stats.averageScore != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tabular-nums text-white"
              style={{ background: scoreTone ?? "var(--muted)" }}
            >
              <Icon name="star" size={11} filled />
              平均 {stats.averageScore}点
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: done ? "var(--success)" : hue }}
          />
        </div>
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-bold text-primary">
          開く
          <Icon name="arrow-right" size={15} />
        </span>
      </div>
    </Link>
  );
}

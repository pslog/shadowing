"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { topicHue } from "@/lib/topic-style";
import { optimizedImageSrc } from "@/lib/optimized-image";
import { useI18n } from "@/components/i18n/useI18n";
import type { Course } from "@/lib/types";
import type { CourseStats } from "@/lib/store/selectors";

export interface CourseEngagementStats {
  totalViews: number;
  shadowingUsers: number;
}

export function CourseCard({
  course,
  stats,
  engagement,
  href,
  priority = false,
}: {
  course: Course;
  stats: CourseStats;
  engagement?: CourseEngagementStats;
  href: string;
  priority?: boolean;
}) {
  const { dictionary: m, href: localizedHref } = useI18n();
  const hue = course.accent ?? topicHue(course.topic);
  const imageSrc = optimizedImageSrc(course.image_url);
  const done = stats.total > 0 && stats.completed >= stats.total;
  const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const totalViews = engagement?.totalViews ?? 0;
  const shadowingUsers = engagement?.shadowingUsers ?? 0;
  const scoreTone =
    stats.averageScore == null
      ? null
      : stats.averageScore >= 80
        ? "var(--success)"
        : "var(--warning)";

  return (
    <Link
      href={localizedHref(href)}
      prefetch={false}
      className={[
        "card card-interactive tint-hue group relative grid h-full grid-cols-[7.25rem_minmax(0,1fr)] overflow-hidden p-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]",
        done ? "ring-2 ring-[var(--success)]/35" : "",
      ].join(" ")}
      style={{ ["--tile-c" as string]: done ? "var(--success)" : hue }}
    >
      <div
        className="relative min-h-52 w-full overflow-hidden rounded-[0.7rem] border border-border bg-surface sm:min-h-48"
        style={
          imageSrc
            ? undefined
            : {
                background: `linear-gradient(145deg, color-mix(in srgb, ${
                  done ? "var(--success)" : hue
                } 22%, transparent), var(--surface))`,
              }
        }
      >
        {imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(max-width: 640px) calc(100vw - 3rem), 10rem"
              className="media-vivid object-cover"
              quality={70}
              priority={priority}
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

      <div className="flex min-w-0 flex-1 flex-col px-3 py-2 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {course.level && <Badge>{course.level}</Badge>}
            <Badge tone={done ? "success" : "primary"}>
              {done ? m.common.allDone : `${stats.total}${m.common.lessons}`}
            </Badge>
            {stats.averageScore != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
                style={{ background: scoreTone ?? "var(--muted)" }}
              >
                <Icon name="star" size={11} filled />
                {m.common.average} {stats.averageScore}{m.common.scoreSuffix}
              </span>
            )}
          </div>
          <span
            className="inline-flex h-7 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[11px] font-bold text-muted"
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
          </span>
        </div>

        <h3 lang="ja" className="mt-3 line-clamp-2 text-lg font-bold leading-snug">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted sm:text-sm sm:leading-6">
            {course.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-fg tabular-nums">
              {stats.completed}/{stats.total} {m.lessonCard.completedSuffix}
            </span>
            <span className="font-semibold text-muted tabular-nums">
              {Math.round(pct)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_13%,var(--surface))]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: done ? "var(--success)" : hue }}
            />
          </div>
          <span className="mt-3 inline-flex min-h-11 items-center gap-1 border-t border-border pt-3 text-sm font-bold text-accent">
            {m.common.open}
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

"use client";

import { useEffect, useState } from "react";

export interface CourseEngagementStats {
  courseId: string;
  totalViews: number;
  shadowingUsers: number;
}

interface CourseEngagementPayload {
  courses?: CourseEngagementStats[];
}

const cacheKey = "all";
const statsCache = new Map<string, Record<string, CourseEngagementStats>>();
const statsPending = new Map<string, Promise<Record<string, CourseEngagementStats>>>();

export function useCourseEngagementStats(enabled = true) {
  const [stats, setStats] = useState<Record<string, CourseEngagementStats>>({});

  useEffect(() => {
    if (!enabled) {
      setStats({});
      return;
    }

    const cached = statsCache.get(cacheKey);
    if (cached) {
      setStats(cached);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const pending =
        statsPending.get(cacheKey) ??
        fetch("/api/course-engagement", { cache: "no-store" })
          .then(async (response) => {
            const raw = await response.text();
            const payload = raw ? (JSON.parse(raw) as CourseEngagementPayload) : null;
            if (!response.ok || !payload) return {};
            return (payload.courses ?? []).reduce<Record<string, CourseEngagementStats>>(
              (acc, row) => {
                acc[row.courseId] = {
                  courseId: row.courseId,
                  totalViews: row.totalViews ?? 0,
                  shadowingUsers: row.shadowingUsers ?? 0,
                };
                return acc;
              },
              {},
            );
          })
          .finally(() => statsPending.delete(cacheKey));

      statsPending.set(cacheKey, pending);
      pending
        .then((next) => {
          statsCache.set(cacheKey, next);
          if (!cancelled) setStats(next);
        })
        .catch(() => {
          if (!cancelled) setStats({});
        });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [enabled]);

  return stats;
}

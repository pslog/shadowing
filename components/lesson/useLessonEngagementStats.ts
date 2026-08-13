"use client";

import { useEffect, useMemo, useState } from "react";

export interface LessonEngagementStats {
  lessonId: string;
  totalViews: number;
  shadowingUsers: number;
  completedUsers: number;
}

interface LessonEngagementPayload {
  lessons?: LessonEngagementStats[];
}

const LESSON_STATS_BATCH_SIZE = 100;
const statsCache = new Map<string, Record<string, LessonEngagementStats>>();
const statsPending = new Map<string, Promise<Record<string, LessonEngagementStats>>>();

export function useLessonEngagementStats(lessonIds: string[], enabled = true) {
  const stableLessonIds = useMemo(
    () => [...new Set(lessonIds.filter(Boolean))].sort(),
    [lessonIds.join("|")],
  );
  const lessonIdsKey = stableLessonIds.join(",");
  const [stats, setStats] = useState<Record<string, LessonEngagementStats>>({});

  useEffect(() => {
    if (!enabled || !lessonIdsKey) {
      setStats({});
      return;
    }

    let cancelled = false;
    const cached = statsCache.get(lessonIdsKey);
    if (cached) {
      setStats(cached);
      return;
    }

    const batches: string[][] = [];
    for (let i = 0; i < stableLessonIds.length; i += LESSON_STATS_BATCH_SIZE) {
      batches.push(stableLessonIds.slice(i, i + LESSON_STATS_BATCH_SIZE));
    }

    const timeout = window.setTimeout(() => {
      const pending =
        statsPending.get(lessonIdsKey) ??
        Promise.all(
          batches.map(async (batch) => {
            const query = batch.map(encodeURIComponent).join(",");
            const response = await fetch(`/api/lesson-views?lessonIds=${query}`, {
              cache: "no-store",
            });
            const raw = await response.text();
            const payload = raw ? (JSON.parse(raw) as LessonEngagementPayload) : null;
            if (!response.ok || !payload) return [];
            return payload.lessons ?? [];
          }),
        )
          .then((results) =>
            results.flat().reduce<Record<string, LessonEngagementStats>>((acc, row) => {
            acc[row.lessonId] = {
              lessonId: row.lessonId,
              totalViews: row.totalViews ?? 0,
              shadowingUsers: row.shadowingUsers ?? 0,
              completedUsers: row.completedUsers ?? 0,
            };
            return acc;
          }, {}),
          )
          .finally(() => statsPending.delete(lessonIdsKey));

      statsPending.set(lessonIdsKey, pending);
      pending
        .then((next) => {
          statsCache.set(lessonIdsKey, next);
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
  }, [enabled, lessonIdsKey]);

  return stats;
}

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
    const batches = [];
    for (let i = 0; i < stableLessonIds.length; i += LESSON_STATS_BATCH_SIZE) {
      batches.push(stableLessonIds.slice(i, i + LESSON_STATS_BATCH_SIZE));
    }

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
      .then((results) => results.flat())
      .then((rows) => {
        if (cancelled) return;
        setStats(
          rows.reduce<Record<string, LessonEngagementStats>>((acc, row) => {
            acc[row.lessonId] = {
              lessonId: row.lessonId,
              totalViews: row.totalViews ?? 0,
              shadowingUsers: row.shadowingUsers ?? 0,
              completedUsers: row.completedUsers ?? 0,
            };
            return acc;
          }, {}),
        );
      })
      .catch(() => {
        if (!cancelled) setStats({});
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, lessonIdsKey]);

  return stats;
}

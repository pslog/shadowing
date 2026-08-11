"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminConsoleShell } from "@/components/admin/AdminConsoleShell";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FullScreenLoading } from "@/components/ui/loading";
import { Icon } from "@/components/ui/icon";
import { useData } from "@/lib/store/DataProvider";
import { isAdminProfile } from "@/lib/store/selectors";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { useI18n } from "@/components/i18n/useI18n";

interface LessonViewOverview {
  totalViews: number;
  viewedLessonCount: number;
  totalSignedInViewers: number;
  totalAnonymousViewers: number;
  totalShadowingUsers: number;
  totalCompletedUsers: number;
}

interface LessonViewRow {
  lessonId: string;
  title: string;
  slug: string | null;
  courseId: string | null;
  topic: string | null;
  level: string | null;
  totalViews: number;
  signedInViewers: number;
  anonymousViewers: number;
  shadowingAttempts: number;
  shadowingUsers: number;
  completedUsers: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
}

interface LessonViewsPayload {
  overview: LessonViewOverview;
  lessons: LessonViewRow[];
}

function formatDate(value: string | null, localeTag: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeTag, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminLessonViewsPage() {
  const { profile, ready } = useRequireProfile();
  const { usingSupabase } = useData();
  const { localeTag, dictionary, href } = useI18n();
  const t = dictionary.adminViews;
  const [data, setData] = useState<LessonViewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = isAdminProfile(profile);

  const loadStats = useCallback(async () => {
    if (!usingSupabase || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/lesson-views", { cache: "no-store" });
      const raw = await response.text();
      const payload = raw ? JSON.parse(raw) : null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load lesson views");
      }
      if (!payload) throw new Error("Lesson view API returned an empty response");
      setData(payload as LessonViewsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load lesson views");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, usingSupabase]);

  useEffect(() => {
    if (ready) void loadStats();
  }, [loadStats, ready]);

  const viewedLessons = useMemo(
    () => (data?.lessons ?? []).filter((lesson) => lesson.totalViews > 0),
    [data],
  );
  const topLesson = viewedLessons[0] ?? null;

  if (!ready || !profile) return <FullScreenLoading />;
  if (!canView) return <AdminOnlyNotice />;

  return (
    <AdminConsoleShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted">{t.subtitle}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadStats()}>
          <Icon name="retry" size={16} />
          {t.refresh}
        </Button>
      </div>

      {!usingSupabase && (
        <Card className="mb-4">
          <CardTitle>{t.supabaseTitle}</CardTitle>
          <p className="mt-2 text-sm text-muted">{t.supabaseBody}</p>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>{t.totalViews}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.totalViews ?? "-"}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.viewedLessons}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.viewedLessonCount ?? "-"}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.signedInViewers}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.totalSignedInViewers ?? "-"}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.guestViewers}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.totalAnonymousViewers ?? "-"}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.shadowingUsers}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.totalShadowingUsers ?? "-"}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.completedUsers}</CardTitle>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {data?.overview.totalCompletedUsers ?? "-"}
          </p>
        </Card>
      </div>

      {topLesson && (
        <Card className="mb-5 border-primary/20 bg-primary/7">
          <CardTitle>{t.topLessonTitle}</CardTitle>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-extrabold">{topLesson.title}</p>
              <p className="mt-1 text-sm text-muted">
                {t.lastViewed} {formatDate(topLesson.lastViewedAt, localeTag)}
              </p>
            </div>
            <Badge tone="primary" className="w-fit">
              {topLesson.totalViews.toLocaleString()} views
            </Badge>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>{t.tableTitle}</CardTitle>
          <p className="mt-1 text-sm text-muted">{t.tableSubtitle}</p>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-muted">{t.loading}</div>
        ) : !data || data.lessons.length === 0 ? (
          <div className="p-5 text-sm text-muted">{t.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-border bg-surface/70 text-xs uppercase text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t.colLesson}</th>
                  <th className="px-5 py-3 font-semibold">{t.colCategory}</th>
                  <th className="px-5 py-3 text-right font-semibold">Views</th>
                  <th className="px-5 py-3 text-right font-semibold">Login</th>
                  <th className="px-5 py-3 text-right font-semibold">Guest</th>
                  <th className="px-5 py-3 text-right font-semibold">Shadowing</th>
                  <th className="px-5 py-3 text-right font-semibold">Complete</th>
                  <th className="px-5 py-3 font-semibold">{t.colLastViewed}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lessons.map((lesson) => (
                  <tr key={lesson.lessonId} className="align-middle">
                    <td className="px-5 py-4">
                      <Link
                        href={href(`/lessons/${lesson.slug ?? lesson.lessonId}`)}
                        className="font-semibold hover:text-primary"
                      >
                        {lesson.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{lesson.lessonId}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {lesson.topic && <Badge tone="primary">{lesson.topic}</Badge>}
                        {lesson.level && <Badge>{lesson.level}</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-extrabold tabular-nums">
                      {lesson.totalViews.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {lesson.signedInViewers.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {lesson.anonymousViewers.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums">
                      {lesson.shadowingUsers.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {lesson.completedUsers.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {formatDate(lesson.lastViewedAt, localeTag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminConsoleShell>
  );
}

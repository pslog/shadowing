"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MascotBadge } from "@/components/ui/mascot";
import { levelMascot, levelTitle } from "@/lib/gamification/level";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n/useI18n";

export interface UserDetailResponse {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    level: number;
    xp: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    provider: string | null;
  };
  activity: {
    attempts: number;
    passedAttempts: number;
    passedSentences: number;
    avgScore: number | null;
    bestScore: number | null;
    firstAttemptAt: string | null;
    lastAttemptAt: string | null;
    practiceDays: number;
    missionDays: number;
    missionsCompleted: number;
    lessonsCompleted: number;
    lessonsInProgress: number;
    readingCompleted: number;
    shadowingCompleted: number;
    vocabSaved: number;
    vocabLearned: number;
    xpByType: Record<string, number>;
  };
  recentLessons: {
    lessonId: string;
    title: string;
    slug: string | null;
    topic: string | null;
    status: string;
    passed: number;
    total: number;
    updatedAt: string;
    completedAt: string | null;
  }[];
}

/** Full profile of one learner, for admins. Fetched on open, never preloaded. */
export function UserDetailDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { dictionary, href, locale, localeTag } = useI18n();
  const t = dictionary.adminUsers.detail;
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    void (async () => {
      try {
        const supabase = await createSupabaseClient();
        // The route reads other users' rows with the service key, so it needs
        // proof that the CALLER is an admin — that proof is this token.
        const token = (await supabase?.auth.getSession())?.data.session?.access_token;
        const response = await fetch(
          `/api/admin/user-detail?userId=${encodeURIComponent(userId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as UserDetailResponse;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setError(t.failed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t.failed, userId]);

  const dateTime = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleString(localeTag, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : t.never;

  if (typeof document === "undefined") return null;

  const user = data?.user;
  const activity = data?.activity;
  const mascot = levelMascot(user?.level ?? 1);
  const passRate =
    activity && activity.attempts > 0
      ? Math.round((activity.passedAttempts / activity.attempts) * 100)
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="animate-pop relative m-auto w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-lg)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />

        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={user?.avatarUrl ?? null}
              name={user?.displayName || user?.email}
              className="h-12 w-12 rounded-full font-bold"
              fallbackClassName="bg-surface text-primary"
            />
            <div className="min-w-0">
              <h2 id="user-detail-title" className="truncate text-lg font-extrabold">
                {user?.displayName || user?.email || t.title}
              </h2>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="focus-ring -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <Icon name="plus" size={16} className="rotate-45" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {error ? (
            <p className="py-8 text-center text-sm text-danger">{error}</p>
          ) : !data || !user || !activity ? (
            <p className="py-8 text-center text-sm text-muted">{t.loading}</p>
          ) : (
            <div className="space-y-5">
              {/* Level card: the one number that summarises everything below. */}
              <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                <MascotBadge slug={mascot.slug} accent={mascot.accent} size={54} />
                <div className="min-w-0">
                  <p className="text-lg font-extrabold">
                    Lv.{user.level}{" "}
                    <span className="text-sm font-bold text-muted">
                      {levelTitle(user.level, locale)}
                    </span>
                  </p>
                  <p className="text-sm font-bold text-primary tabular-nums">
                    {user.xp.toLocaleString(localeTag)} XP
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Badge tone={user.role === "admin" ? "warning" : "neutral"}>
                    {user.role}
                  </Badge>
                  <Badge tone="success">
                    {user.currentStreak}
                    {t.days}
                  </Badge>
                </div>
              </div>

              <Section title={t.sectionAccount}>
                <Row label={t.createdAt} value={dateTime(user.createdAt)} />
                <Row label={t.lastSignIn} value={dateTime(user.lastSignInAt)} />
                <Row label={t.emailConfirmed} value={dateTime(user.emailConfirmedAt)} />
                <Row label={t.provider} value={user.provider ?? t.never} />
                <Row label={t.userId} value={user.id} mono />
              </Section>

              <Section title={t.sectionLearning}>
                <Tiles
                  items={[
                    { label: t.passedSentences, value: activity.passedSentences, strong: true },
                    { label: t.attempts, value: activity.attempts },
                    { label: t.passRate, value: passRate == null ? "—" : `${passRate}%` },
                    { label: t.avgScore, value: activity.avgScore ?? "—" },
                    { label: t.bestScore, value: activity.bestScore ?? "—" },
                    { label: t.practiceDays, value: activity.practiceDays },
                  ]}
                />
                <div className="mt-2">
                  <Row label={t.firstAttempt} value={dateTime(activity.firstAttemptAt)} />
                  <Row label={t.lastAttempt} value={dateTime(activity.lastAttemptAt)} />
                </div>
              </Section>

              <Section title={t.sectionProgress}>
                <Tiles
                  items={[
                    { label: t.lessonsCompleted, value: activity.lessonsCompleted, strong: true },
                    { label: t.lessonsInProgress, value: activity.lessonsInProgress },
                    { label: t.shadowingCompleted, value: activity.shadowingCompleted },
                    { label: t.readingCompleted, value: activity.readingCompleted },
                    { label: t.missionsCompleted, value: activity.missionsCompleted },
                    { label: t.missionDays, value: activity.missionDays },
                    { label: t.longestStreak, value: user.longestStreak },
                  ]}
                />
                <div className="mt-2">
                  <Row
                    label={t.vocab}
                    value={t.vocabValue(activity.vocabSaved, activity.vocabLearned)}
                  />
                </div>
              </Section>

              <Section title={t.sectionXp}>
                <Tiles
                  items={[
                    {
                      label: t.xpSentence,
                      value:
                        (activity.xpByType.sentence_pass ?? 0) +
                        (activity.xpByType.sentence_pass_high ?? 0),
                    },
                    { label: t.xpLessonComplete, value: activity.xpByType.lesson_complete ?? 0 },
                    { label: t.xpMission, value: activity.xpByType.mission_complete ?? 0 },
                    { label: t.xpStreak, value: activity.xpByType.streak_milestone ?? 0 },
                    { label: t.xpReading, value: activity.xpByType.reading_complete ?? 0 },
                  ]}
                />
              </Section>

              <Section
                title={`${t.sectionRecent} (${data.recentLessons.length})`}
              >
                {data.recentLessons.length === 0 ? (
                  <p className="text-sm text-muted">{t.recentEmpty}</p>
                ) : (
                  // Its own scroll box: a heavy learner has dozens of these, and
                  // they must not push the sections above out of reach.
                  <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                    {data.recentLessons.map((lesson) => (
                      <li key={lesson.lessonId}>
                        <a
                          href={href(`/lessons/${lesson.slug ?? lesson.lessonId}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-ring flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface"
                        >
                          <div className="min-w-0">
                            <p
                              lang="ja"
                              className="truncate text-sm font-bold text-fg"
                            >
                              {lesson.title}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {lesson.topic ? `${lesson.topic} · ` : ""}
                              {dateTime(lesson.completedAt ?? lesson.updatedAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {lesson.total > 0 && (
                              <span className="text-xs font-bold tabular-nums text-muted">
                                {lesson.passed}/{lesson.total}
                              </span>
                            )}
                            <Badge
                              tone={lesson.status === "completed" ? "success" : "neutral"}
                            >
                              {lesson.status === "completed"
                                ? t.statusCompleted
                                : t.statusInProgress}
                            </Badge>
                            <Icon
                              name="arrow-right"
                              size={14}
                              className="text-muted"
                            />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 text-right">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="shrink-0 text-xs font-bold text-muted">{label}</span>
      <span
        className={[
          "min-w-0 truncate text-right text-sm font-semibold",
          mono ? "font-mono text-xs text-muted" : "text-fg",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function Tiles({
  items,
}: {
  items: { label: string; value: string | number; strong?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-surface px-3 py-2">
          <p className="text-[11px] font-bold text-muted">{item.label}</p>
          <p
            className={[
              "mt-0.5 font-extrabold tabular-nums",
              item.strong ? "text-lg text-primary" : "text-base text-fg",
            ].join(" ")}
          >
            {typeof item.value === "number"
              ? item.value.toLocaleString()
              : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

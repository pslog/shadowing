import { NextResponse } from "next/server";

// Everything an admin needs to understand one learner: who they are, when the
// account started, when they were last seen, and what they have actually done.
//
// This has to run server-side with the service key. RLS scopes attempts,
// progress, missions and vocabulary to `auth.uid()`, so an admin querying from
// the browser sees their OWN numbers under someone else's name — worse than no
// data. The route therefore verifies the CALLER is an admin, then reads the
// target's rows with the service key.

import { ADMIN_EMAIL } from "@/lib/store/selectors";

export const dynamic = "force-dynamic";

function serviceConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !serviceKey || !anonKey) return null;
  return { baseUrl, serviceKey, anonKey };
}

/** REST read with the service key. `headOnly` returns just the exact row count. */
async function restGet<T>(path: string): Promise<T | null> {
  const config = serviceConfig();
  if (!config) return null;
  const response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** The Auth admin API — the only place `last_sign_in_at` lives. */
async function authUser(userId: string): Promise<Record<string, unknown> | null> {
  const config = serviceConfig();
  if (!config) return null;
  const response = await fetch(`${config.baseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}

/** Resolves the bearer token to a user, then to their role. Null = not an admin. */
async function callerIsAdmin(token: string | null): Promise<boolean> {
  const config = serviceConfig();
  if (!config || !token) return false;

  const response = await fetch(`${config.baseUrl}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const user = (await response.json()) as { id?: string; email?: string };
  if (!user?.id) return false;
  if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;

  const rows = await restGet<{ role: string }[]>(
    `profiles?id=eq.${user.id}&select=role&limit=1`,
  );
  return rows?.[0]?.role === "admin";
}

interface AttemptRow {
  sentence_id: string;
  lesson_id: string;
  total_score: number;
  is_passed: boolean;
  created_at: string;
}

interface ProgressRow {
  lesson_id: string;
  status: string;
  passed_sentence_count: number | null;
  total_sentence_count: number | null;
  completed_at: string | null;
  updated_at: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!serviceConfig()) {
    return NextResponse.json(
      { error: "Missing Supabase service configuration" },
      { status: 503 },
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await callerIsAdmin(token))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const [profileRows, auth, attempts, progress, missions, xpEvents, vocab, reading] =
    await Promise.all([
      restGet<Record<string, unknown>[]>(
        `profiles?id=eq.${userId}&select=id,email,display_name,avatar_url,role,total_xp,current_level,current_streak,longest_streak,last_completed_date,created_at&limit=1`,
      ),
      authUser(userId),
      restGet<AttemptRow[]>(
        `sentence_attempts?user_id=eq.${userId}&select=sentence_id,lesson_id,total_score,is_passed,created_at&order=created_at.asc`,
      ),
      restGet<ProgressRow[]>(
        `lesson_progress?user_id=eq.${userId}&select=lesson_id,status,passed_sentence_count,total_sentence_count,completed_at,updated_at&order=updated_at.desc`,
      ),
      restGet<{ mission_date: string; is_completed: boolean }[]>(
        `daily_missions?user_id=eq.${userId}&select=mission_date,is_completed`,
      ),
      restGet<{ event_type: string; xp_amount: number }[]>(
        `xp_events?user_id=eq.${userId}&select=event_type,xp_amount`,
      ),
      restGet<{ learned: boolean }[]>(
        `saved_vocab?user_id=eq.${userId}&select=learned`,
      ),
      // Reading completions live in their own table (they also track anonymous
      // sessions), so lesson_progress alone under-reports reading.
      restGet<{ lesson_id: string }[]>(
        `reading_progress?user_id=eq.${userId}&select=lesson_id`,
      ),
    ]);

  const profile = profileRows?.[0];
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const attemptRows = attempts ?? [];
  const progressRows = progress ?? [];
  const missionRows = missions ?? [];
  const xpRows = xpEvents ?? [];
  const vocabRows = vocab ?? [];
  const readingRows = reading ?? [];

  // Lesson titles/topics for the lessons this user actually touched, so the
  // recent list reads as lesson names and reading can be told from shadowing.
  const touchedIds = [
    ...new Set([
      ...progressRows.map((row) => row.lesson_id),
      ...attemptRows.map((row) => row.lesson_id),
    ]),
  ].filter(Boolean);
  // Chunked: a heavy user can touch hundreds of lessons, and one `id=in.(...)`
  // with every UUID inlined runs past what the REST layer accepts as a URL.
  const CHUNK = 80;
  const lessonChunks = await Promise.all(
    Array.from({ length: Math.ceil(touchedIds.length / CHUNK) }, (_, index) =>
      restGet<{ id: string; title: string; topic: string | null; slug: string | null }[]>(
        `lessons?id=in.(${touchedIds.slice(index * CHUNK, (index + 1) * CHUNK).join(",")})&select=id,title,topic,slug`,
      ),
    ),
  );
  const lessonById = new Map(
    lessonChunks.flatMap((chunk) => chunk ?? []).map((lesson) => [lesson.id, lesson]),
  );

  const passedSentenceIds = new Set(
    attemptRows.filter((row) => row.is_passed).map((row) => row.sentence_id),
  );
  const scores = attemptRows.map((row) => row.total_score ?? 0);
  // Distinct calendar days with at least one attempt — "how many days did they
  // actually show up", which a raw attempt count hides.
  const attemptDays = new Set(attemptRows.map((row) => row.created_at.slice(0, 10)));

  const completed = progressRows.filter((row) => row.status === "completed");
  const readingCompleted = completed.filter(
    (row) => lessonById.get(row.lesson_id)?.topic === "読解",
  ).length;

  const xpByType: Record<string, number> = {};
  for (const row of xpRows) {
    xpByType[row.event_type] = (xpByType[row.event_type] ?? 0) + (row.xp_amount ?? 0);
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email ?? (auth?.email as string | undefined) ?? null,
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: profile.role ?? "user",
      level: profile.current_level ?? 1,
      xp: profile.total_xp ?? 0,
      currentStreak: profile.current_streak ?? 0,
      longestStreak: profile.longest_streak ?? 0,
      lastCompletedDate: profile.last_completed_date ?? null,
      // Prefer the auth timestamp: the profile row can be re-created later.
      createdAt: (auth?.created_at as string | undefined) ?? profile.created_at ?? null,
      lastSignInAt: (auth?.last_sign_in_at as string | undefined) ?? null,
      emailConfirmedAt:
        (auth?.email_confirmed_at as string | undefined) ??
        (auth?.confirmed_at as string | undefined) ??
        null,
      provider:
        ((auth?.app_metadata as { provider?: string } | undefined)?.provider) ?? null,
    },
    activity: {
      attempts: attemptRows.length,
      passedAttempts: attemptRows.filter((row) => row.is_passed).length,
      passedSentences: passedSentenceIds.size,
      avgScore: scores.length
        ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
        : null,
      bestScore: scores.length ? Math.max(...scores) : null,
      firstAttemptAt: attemptRows[0]?.created_at ?? null,
      lastAttemptAt: attemptRows[attemptRows.length - 1]?.created_at ?? null,
      practiceDays: attemptDays.size,
      missionDays: missionRows.length,
      missionsCompleted: missionRows.filter((row) => row.is_completed).length,
      lessonsCompleted: completed.length,
      lessonsInProgress: progressRows.length - completed.length,
      readingCompleted: Math.max(
        readingCompleted,
        new Set(readingRows.map((row) => row.lesson_id)).size,
      ),
      shadowingCompleted: completed.length - readingCompleted,
      vocabSaved: vocabRows.length,
      vocabLearned: vocabRows.filter((row) => row.learned).length,
      xpByType,
    },
    // Every lesson the learner has touched, newest first — the admin panel
    // scrolls it, so there is nothing to truncate and nothing to explain away.
    recentLessons: progressRows.map((row) => {
      const lesson = lessonById.get(row.lesson_id);
      return {
        lessonId: row.lesson_id,
        title: lesson?.title ?? row.lesson_id,
        slug: lesson?.slug ?? null,
        topic: lesson?.topic ?? null,
        status: row.status,
        passed: row.passed_sentence_count ?? 0,
        total: row.total_sentence_count ?? 0,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      };
    }),
  });
}

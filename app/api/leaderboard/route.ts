import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number | null;
  current_level: number | null;
  current_streak: number | null;
}

interface AttemptRow {
  user_id: string;
  total_score: number | null;
  is_passed: boolean | null;
}

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  totalXp: number;
  level: number;
  streak: number;
  attempts: number;
  passed: number;
  averageScore: number | null;
}

async function supabaseRest<T>(path: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error("Missing Supabase service configuration");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export async function GET() {
  try {
    const [profiles, attempts] = await Promise.all([
      supabaseRest<ProfileRow[]>(
        "profiles?select=id,display_name,avatar_url,total_xp,current_level,current_streak",
      ),
      supabaseRest<AttemptRow[]>(
        "sentence_attempts?select=user_id,total_score,is_passed",
      ),
    ]);

    const attemptsByUser = new Map<
      string,
      { attempts: number; passed: number; scoreTotal: number }
    >();

    for (const attempt of attempts) {
      const current =
        attemptsByUser.get(attempt.user_id) ??
        { attempts: 0, passed: 0, scoreTotal: 0 };
      current.attempts += 1;
      current.passed += attempt.is_passed ? 1 : 0;
      current.scoreTotal += attempt.total_score ?? 0;
      attemptsByUser.set(attempt.user_id, current);
    }

    const users: LeaderboardUser[] = profiles.map((profile) => {
      const stats = attemptsByUser.get(profile.id) ?? {
        attempts: 0,
        passed: 0,
        scoreTotal: 0,
      };
      return {
        id: profile.id,
        displayName: profile.display_name || "学習者",
        avatarUrl: profile.avatar_url,
        totalXp: profile.total_xp ?? 0,
        level: profile.current_level ?? 1,
        streak: profile.current_streak ?? 0,
        attempts: stats.attempts,
        passed: stats.passed,
        averageScore:
          stats.attempts > 0 ? Math.round(stats.scoreTotal / stats.attempts) : null,
      };
    });

    const rankedByXp = [...users].sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      if (b.passed !== a.passed) return b.passed - a.passed;
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });
    const rankedByScore = [...users]
      .filter((user) => user.attempts > 0)
      .sort((a, b) => {
        if ((b.averageScore ?? 0) !== (a.averageScore ?? 0)) {
          return (b.averageScore ?? 0) - (a.averageScore ?? 0);
        }
        return b.passed - a.passed;
      });

    const totalAttempts = attempts.length;
    const totalPassed = attempts.filter((attempt) => attempt.is_passed).length;
    const scoredAttempts = attempts.filter((attempt) => attempt.total_score != null);
    const systemAverageScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, attempt) => sum + (attempt.total_score ?? 0), 0) /
              scoredAttempts.length,
          )
        : null;

    return NextResponse.json({
      overview: {
        learnerCount: users.length,
        totalAttempts,
        totalPassed,
        systemAverageScore,
      },
      topXp: rankedByXp.slice(0, 5),
      topScore: rankedByScore.slice(0, 5),
      ranks: rankedByXp.map((user, index) => ({
        userId: user.id,
        rank: index + 1,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load leaderboard",
      },
      { status: 500 },
    );
  }
}

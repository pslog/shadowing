import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface LessonViewPayload {
  lessonId?: unknown;
  anonymousSessionId?: unknown;
  path?: unknown;
}

interface LessonViewStatsRow {
  lesson_id: string;
  lesson_title: string;
  lesson_slug: string | null;
  course_id: string | null;
  topic: string | null;
  level: string | null;
  total_views: number | null;
  signed_in_viewers: number | null;
  anonymous_viewers: number | null;
  shadowing_attempts: number | null;
  shadowing_users: number | null;
  completed_users: number | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
}

interface LessonViewOverviewRow {
  total_views: number | null;
  viewed_lesson_count: number | null;
  signed_in_viewers: number | null;
  anonymous_viewers: number | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  shadowing_users: number | null;
  completed_users: number | null;
}

function mapLessonStats(row: LessonViewStatsRow) {
  return {
    lessonId: row.lesson_id,
    title: row.lesson_title,
    slug: row.lesson_slug,
    courseId: row.course_id,
    topic: row.topic,
    level: row.level,
    totalViews: row.total_views ?? 0,
    signedInViewers: row.signed_in_viewers ?? 0,
    anonymousViewers: row.anonymous_viewers ?? 0,
    shadowingAttempts: row.shadowing_attempts ?? 0,
    shadowingUsers: row.shadowing_users ?? 0,
    completedUsers: row.completed_users ?? 0,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
  };
}

function serviceConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl, serviceKey };
}

async function supabaseRest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = serviceConfig();
  if (!config) {
    return { data: null, error: "Missing Supabase service configuration", status: 503 };
  }

  const response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { data: null, error: await response.text(), status: response.status };
  }

  if (response.status === 204) {
    return { data: null, error: null, status: response.status };
  }

  return { data: (await response.json()) as T, error: null, status: response.status };
}

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function currentUserIsAdmin() {
  const user = await currentUser();
  if (!user) return false;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("role,email")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return false;
  return data.role === "admin" || data.email === "vovansinh1991@gmail.com";
}

function emptyLessonStats(lessonId: string) {
  return {
    lessonId,
    title: "",
    slug: null,
    courseId: null,
    topic: null,
    level: null,
    totalViews: 0,
    signedInViewers: 0,
    anonymousViewers: 0,
    shadowingAttempts: 0,
    shadowingUsers: 0,
    completedUsers: 0,
    firstViewedAt: null,
    lastViewedAt: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as LessonViewPayload;
    const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    const user = await currentUser();
    const anonymousSessionId =
      typeof body.anonymousSessionId === "string"
        ? body.anonymousSessionId.slice(0, 80)
        : null;
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
    const referrer = request.headers.get("referer")?.slice(0, 500) ?? null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { error, status } = await supabaseRest<null>("lesson_views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lesson_id: lessonId,
        user_id: user?.id ?? null,
        anonymous_session_id: user ? null : anonymousSessionId,
        path,
        referrer,
        user_agent: userAgent,
      }),
    });

    if (error) {
      return NextResponse.json({ error }, { status: status || 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record lesson view" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lessonId")?.trim();
  const overviewOnly = request.nextUrl.searchParams.get("overview") === "1";
  const lessonIds = request.nextUrl.searchParams
    .get("lessonIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (lessonId) {
    const encodedLessonId = encodeURIComponent(lessonId);
    const { data, error, status } = await supabaseRest<LessonViewStatsRow[]>(
      `lesson_view_stats?select=*&lesson_id=eq.${encodedLessonId}&limit=1`,
    );

    if (error) {
      return NextResponse.json({ error }, { status: status || 500 });
    }

    const row = data?.[0];
    return NextResponse.json({
      lesson: row ? mapLessonStats(row) : emptyLessonStats(lessonId),
    });
  }

  if (lessonIds?.length) {
    const encodedIds = lessonIds.map(encodeURIComponent).join(",");
    const { data, error, status } = await supabaseRest<LessonViewStatsRow[]>(
      `lesson_view_stats?select=*&lesson_id=in.(${encodedIds})`,
    );

    if (error) {
      return NextResponse.json({ error }, { status: status || 500 });
    }

    return NextResponse.json({
      lessons: (data ?? []).map(mapLessonStats),
    });
  }

  if (overviewOnly) {
    const { data, error, status } = await supabaseRest<LessonViewOverviewRow[]>(
      "lesson_view_overview?select=total_views,shadowing_users,viewed_lesson_count",
    );

    if (error) {
      return NextResponse.json({ error }, { status: status || 500 });
    }

    const overview = data?.[0];
    return NextResponse.json({
      overview: {
        totalViews: overview?.total_views ?? 0,
        totalShadowingUsers: overview?.shadowing_users ?? 0,
        viewedLessonCount: overview?.viewed_lesson_count ?? 0,
      },
    });
  }

  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [overviewResult, statsResult] = await Promise.all([
    supabaseRest<LessonViewOverviewRow[]>("lesson_view_overview?select=*"),
    supabaseRest<LessonViewStatsRow[]>(
      "lesson_view_stats?select=*&order=total_views.desc,last_viewed_at.desc&limit=500",
    ),
  ]);

  if (overviewResult.error) {
    return NextResponse.json(
      { error: overviewResult.error },
      { status: overviewResult.status || 500 },
    );
  }
  if (statsResult.error) {
    return NextResponse.json(
      { error: statsResult.error },
      { status: statsResult.status || 500 },
    );
  }

  const overview = overviewResult.data?.[0];
  const rows = statsResult.data ?? [];

  return NextResponse.json({
    overview: {
      totalViews: overview?.total_views ?? 0,
      viewedLessonCount: overview?.viewed_lesson_count ?? 0,
      totalSignedInViewers: overview?.signed_in_viewers ?? 0,
      totalAnonymousViewers: overview?.anonymous_viewers ?? 0,
      totalShadowingUsers: overview?.shadowing_users ?? 0,
      totalCompletedUsers: overview?.completed_users ?? 0,
    },
    lessons: rows.map(mapLessonStats),
  });
}

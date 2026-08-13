import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ReadingProgressPayload {
  lessonId?: unknown;
  anonymousSessionId?: unknown;
}

interface ReadingProgressRow {
  id: string;
  lesson_id: string;
  completed_at: string | null;
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

  const text = await response.text();
  return {
    data: text ? (JSON.parse(text) as T) : null,
    error: null,
    status: response.status,
  };
}

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

function identityFilter(userId: string | null, anonymousSessionId: string | null) {
  return userId
    ? `user_id=eq.${encodeURIComponent(userId)}`
    : `anonymous_session_id=eq.${encodeURIComponent(anonymousSessionId ?? "")}`;
}

async function lessonSentenceCount(lessonId: string) {
  const { data } = await supabaseRest<{ id: string }[]>(
    `lesson_sentences?select=id&lesson_id=eq.${encodeURIComponent(lessonId)}`,
  );
  return data?.length ?? 0;
}

async function syncLessonProgress(userId: string, lessonId: string) {
  const now = new Date().toISOString();
  const total = await lessonSentenceCount(lessonId);
  const filter = `user_id=eq.${encodeURIComponent(userId)}&lesson_id=eq.${encodeURIComponent(lessonId)}&limit=1`;
  const existing = await supabaseRest<{ id: string; passed_sentence_count: number | null; total_sentence_count: number | null; completed_at: string | null }[]>(
    `lesson_progress?select=id,passed_sentence_count,total_sentence_count,completed_at&${filter}`,
  );
  const current = existing.data?.[0];
  const payload = {
    user_id: userId,
    lesson_id: lessonId,
    status: "completed",
    passed_sentence_count: Math.max(current?.passed_sentence_count ?? 0, total),
    total_sentence_count: Math.max(current?.total_sentence_count ?? 0, total),
    completed_at: current?.completed_at ?? now,
    updated_at: now,
  };

  if (current) {
    await supabaseRest<null>(`lesson_progress?id=eq.${encodeURIComponent(current.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    return;
  }

  await supabaseRest<null>("lesson_progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  const anonymousSessionId = request.nextUrl.searchParams
    .get("anonymousSessionId")
    ?.slice(0, 80) ?? null;
  const lessonIds = request.nextUrl.searchParams
    .get("lessonIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!lessonIds?.length) {
    return NextResponse.json({ lessons: [] });
  }

  if (!user && !anonymousSessionId) {
    return NextResponse.json({ lessons: [] });
  }

  const encodedIds = lessonIds.map(encodeURIComponent).join(",");
  const { data, error, status } = await supabaseRest<ReadingProgressRow[]>(
    `reading_progress?select=id,lesson_id,completed_at&lesson_id=in.(${encodedIds})&${identityFilter(
      user?.id ?? null,
      anonymousSessionId,
    )}`,
  );

  if (error) {
    return NextResponse.json({ error }, { status: status || 500 });
  }

  return NextResponse.json({
    lessons: (data ?? []).map((row) => ({
      lessonId: row.lesson_id,
      completedAt: row.completed_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReadingProgressPayload;
    const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    const user = await currentUser();
    const anonymousSessionId =
      typeof body.anonymousSessionId === "string"
        ? body.anonymousSessionId.slice(0, 80)
        : null;
    if (!user && !anonymousSessionId) {
      return NextResponse.json({ error: "anonymousSessionId is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const filter = `${identityFilter(user?.id ?? null, anonymousSessionId)}&lesson_id=eq.${encodeURIComponent(
      lessonId,
    )}&limit=1`;
    const existing = await supabaseRest<ReadingProgressRow[]>(
      `reading_progress?select=id,lesson_id,completed_at&${filter}`,
    );
    if (existing.error) {
      return NextResponse.json({ error: existing.error }, { status: existing.status || 500 });
    }

    const current = existing.data?.[0];
    const payload = {
      user_id: user?.id ?? null,
      anonymous_session_id: user ? null : anonymousSessionId,
      lesson_id: lessonId,
      completed_at: current?.completed_at ?? now,
      updated_at: now,
    };

    const result = current
      ? await supabaseRest<null>(`reading_progress?id=eq.${encodeURIComponent(current.id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        })
      : await supabaseRest<null>("reading_progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    if (user) {
      await syncLessonProgress(user.id, lessonId);
    }

    return NextResponse.json({ ok: true, lessonId, completedAt: payload.completed_at });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save reading progress" },
      { status: 500 },
    );
  }
}

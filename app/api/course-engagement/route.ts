import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LessonViewStatsRow {
  course_id: string;
  total_views: number | null;
  shadowing_users: number | null;
  completed_users: number | null;
}

function serviceConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl, serviceKey };
}

async function supabaseRest<T>(
  path: string,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = serviceConfig();
  if (!config) {
    return { data: null, error: "Missing Supabase service configuration", status: 503 };
  }

  const response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { data: null, error: await response.text(), status: response.status };
  }

  const text = await response.text();
  return {
    data: text ? (JSON.parse(text) as T) : null,
    error: null,
    status: response.status,
  };
}

export async function GET() {
  const { data, error, status } = await supabaseRest<LessonViewStatsRow[]>(
    "course_engagement_stats?select=course_id,total_views,shadowing_users,completed_users",
  );

  if (error) {
    return NextResponse.json({ error }, { status: status || 500 });
  }

  return NextResponse.json({
    courses: (data ?? []).map((row) => ({
      courseId: row.course_id,
      totalViews: row.total_views ?? 0,
      shadowingUsers: row.shadowing_users ?? 0,
      completedUsers: row.completed_users ?? 0,
    })),
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SiteVisitPayload {
  anonymousSessionId?: unknown;
  path?: unknown;
}

interface SiteVisitOverviewRow {
  total_visits: number | null;
  signed_in_visitors: number | null;
  anonymous_visitors: number | null;
  first_visited_at: string | null;
  last_visited_at: string | null;
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as SiteVisitPayload;
    const user = await currentUser();
    const anonymousSessionId =
      typeof body.anonymousSessionId === "string"
        ? body.anonymousSessionId.slice(0, 80)
        : null;
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
    const referrer = request.headers.get("referer")?.slice(0, 500) ?? null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { error, status } = await supabaseRest<null>("site_visits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
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
      { error: error instanceof Error ? error.message : "Failed to record site visit" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { data, error, status } = await supabaseRest<SiteVisitOverviewRow[]>(
    "site_visit_overview?select=total_visits",
  );

  if (error) {
    return NextResponse.json({ error }, { status: status || 500 });
  }

  const overview = data?.[0];
  return NextResponse.json({
    overview: {
      totalVisits: overview?.total_visits ?? 0,
    },
  });
}

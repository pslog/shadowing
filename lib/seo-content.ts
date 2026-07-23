import { cache } from "react";

type CourseSeo = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  topic: string | null;
  level: string | null;
};

type LessonSeo = {
  id: string;
  slug: string | null;
  course_id: string | null;
  title: string;
  topic: string | null;
  level: string | null;
};

type FirstSentenceSeo = {
  ja_text: string;
  vi_translation: string | null;
};

function supabaseRestBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { restUrl: `${url.replace(/\/$/, "")}/rest/v1`, key };
}

async function fetchRows<T>(
  table: string,
  query: Record<string, string>,
): Promise<T[]> {
  const config = supabaseRestBase();
  if (!config) return [];

  const params = new URLSearchParams(query);
  const response = await fetch(`${config.restUrl}/${table}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export const courseSeoBySlug = cache(async (key: string) => {
  const select = "id,slug,title,description,topic,level";
  const bySlug = await fetchRows<CourseSeo>("courses", {
    select,
    slug: `eq.${key}`,
    limit: "1",
  });
  if (bySlug[0]) return bySlug[0];

  const byId = await fetchRows<CourseSeo>("courses", {
    select,
    id: `eq.${key}`,
    limit: "1",
  });
  return byId[0] ?? null;
});

export const lessonSeoBySlug = cache(async (key: string) => {
  const select = "id,slug,course_id,title,topic,level";
  const bySlug = await fetchRows<LessonSeo>("lessons", {
    select,
    slug: `eq.${key}`,
    limit: "1",
  });
  const lesson =
    bySlug[0] ??
    (
      await fetchRows<LessonSeo>("lessons", {
        select,
        id: `eq.${key}`,
        limit: "1",
      })
    )[0];

  if (!lesson) return null;

  const firstSentence =
    (
      await fetchRows<FirstSentenceSeo>("lesson_sentences", {
        select: "ja_text,vi_translation",
        lesson_id: `eq.${lesson.id}`,
        order: "order_index.asc",
        limit: "1",
      })
    )[0] ?? null;

  return {
    ...lesson,
    firstSentence,
  };
});

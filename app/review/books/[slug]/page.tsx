"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import {
  VocabularyBookStudy,
  vocabularyBookCopy,
} from "@/components/review/VocabularyBookLibrary";
import { useI18n } from "@/components/i18n/useI18n";
import { useData } from "@/lib/store/DataProvider";
import { createClient } from "@/lib/supabase/client";
import type { VocabularyBook } from "@/lib/types";

export default function VocabularyBookPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { locale, href } = useI18n();
  const { state, ready } = useData();
  const [book, setBook] = useState<VocabularyBook | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .then(async (client) => {
        if (!client) return null;
        const { data } = await client
          .from("vocabulary_books")
          .select("*")
          .eq("slug", params.slug)
          .eq("is_public", true)
          .maybeSingle();
        return data as VocabularyBook | null;
      })
      .then((data) => {
        if (!cancelled) setBook(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  useEffect(() => {
    if (loaded && !book) router.replace(href("/review"));
  }, [book, href, loaded, router]);

  if (!ready || !loaded) return <FullScreenLoading />;
  if (!book) return <FullScreenLoading />;

  return (
    <AppShell>
      <VocabularyBookStudy
        book={book}
        profileId={state.profile?.id ?? null}
        copy={vocabularyBookCopy[locale]}
        onBack={() => router.push(href("/review"))}
      />
    </AppShell>
  );
}

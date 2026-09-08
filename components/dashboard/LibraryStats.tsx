"use client";

// What the library holds, by kind of material.
//
// The homepage used to show one featured course and nothing else, so a first
// visit gave no sense of scale. These are catalogue counts, not activity
// counts: how much there is to study, split the way the app itself splits it
// (shadowing / 読解 / vocabulary cards). Card totals live in Supabase
// (`vocabulary_books.entry_count`); with no Supabase configured that tile drops
// out rather than showing a zero, which would read as "there is nothing here".

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/useI18n";
import { Icon, type IconName } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/lib/store/DataProvider";
import { isReadingLesson, visibleCourses, visibleLessons } from "@/lib/store/selectors";

interface Tile {
  key: string;
  label: string;
  value: number;
  icon: IconName;
  hue: string;
}

/** Total cards across the public vocabulary notebooks. */
function useVocabCardCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .then(async (client) => {
        if (!client) return null;
        const { data } = await client
          .from("vocabulary_books")
          .select("entry_count")
          .eq("is_public", true);
        if (!data) return null;
        return (data as { entry_count: number | null }[]).reduce(
          (sum, row) => sum + (row.entry_count ?? 0),
          0,
        );
      })
      .then((total) => {
        if (!cancelled) setCount(total);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

export function LibraryStats({ compact = false }: { compact?: boolean }) {
  const { state } = useData();
  const { dictionary: m, localeTag } = useI18n();
  const copy = m.dashboard;
  const vocabCards = useVocabCardCount();

  const lessons = visibleLessons(state);
  const reading = lessons.filter((lesson) => isReadingLesson(state, lesson)).length;
  const shadowing = lessons.length - reading;
  const format = (value: number) => value.toLocaleString(localeTag);

  const tiles: Tile[] = [
    {
      key: "courses",
      label: copy.statCourses,
      value: visibleCourses(state).length,
      icon: "book",
      hue: "var(--c-indigo)",
    },
    {
      key: "shadowing",
      label: copy.statShadowing,
      value: shadowing,
      icon: "mic",
      hue: "var(--accent)",
    },
    {
      key: "reading",
      label: copy.statReading,
      value: reading,
      icon: "bookmark",
      hue: "var(--c-sky)",
    },
  ];

  if (vocabCards != null && vocabCards > 0) {
    tiles.push({
      key: "vocab",
      label: copy.statVocab,
      value: vocabCards,
      icon: "cap",
      hue: "var(--c-amber)",
    });
  }

  return (
    <section aria-label={copy.statsTitle}>
      {!compact && (
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
            {copy.statsEyebrow}
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em]">{copy.statsTitle}</h2>
          <p className="mt-1 text-sm text-muted">{copy.statsNote}</p>
        </div>
      )}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile, index) => (
          <div
            key={tile.key}
            className="tile flex items-center gap-3 p-3.5 sm:p-4"
            style={{ ["--tile-c" as string]: tile.hue, ["--i" as string]: index }}
          >
            <span className="tile-icon h-10 w-10 shrink-0">
              <Icon name={tile.icon} size={19} />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-extrabold tabular-nums leading-6 tracking-[-0.03em] text-fg sm:text-2xl">
                {format(tile.value)}
              </span>
              <span className="block truncate text-xs font-bold text-muted">{tile.label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

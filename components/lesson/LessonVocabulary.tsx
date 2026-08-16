"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VocabEntry } from "@/lib/types";
import { useData } from "@/lib/store/DataProvider";
import { isVocabSaved, vocabKey } from "@/lib/store/selectors";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/i18n/useI18n";

interface VocabStat {
  saved_count: number;
  learned_count: number;
}

/**
 * Vocabulary section at the bottom of the lesson detail. Compact static rows:
 * word on top, reading + meaning below, situational example on the right.
 * Shows cross-user popularity (how many saved / learned it) as a soft hint, and
 * lets logged-in users bookmark a word into their notebook (/review).
 * Renders nothing when the lesson has no vocabulary generated yet.
 */
export function LessonVocabulary({
  vocabulary,
  lessonId,
  variant = "compact",
}: {
  vocabulary: VocabEntry[] | null;
  lessonId: string;
  variant?: "compact" | "reading";
}) {
  const { state, toggleSavedVocab } = useData();
  const { dictionary, href } = useI18n();
  const t = dictionary.vocabulary;
  const items = vocabulary ?? [];
  const canSave = Boolean(state.profile);
  const [stats, setStats] = useState<Map<string, VocabStat>>(new Map());
  // Words the user had already saved when the counts were fetched — lets us
  // adjust the displayed count instantly for the current user's own toggles.
  const [savedAtLoad, setSavedAtLoad] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    const words = [...new Set(items.map((v) => v.word))];
    createClient()
      .then((client) =>
        client
          ?.from("vocab_stats")
          .select("word,reading,saved_count,learned_count")
          .in("word", words),
      )
      .then((result) => {
        const data = result?.data;
        if (cancelled || !data) return;
        const map = new Map<string, VocabStat>();
        for (const r of data as (VocabStat & { word: string; reading: string })[]) {
          map.set(vocabKey(r.word, r.reading), {
            saved_count: r.saved_count,
            learned_count: r.learned_count,
          });
        }
        setStats(map);
        setSavedAtLoad(
          new Set(
            items
              .filter((v) => isVocabSaved(state, v))
              .map((v) => vocabKey(v.word, v.reading)),
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // Words are fixed per lesson; re-run only when the lesson changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  if (items.length === 0) return null;

  if (variant === "reading") {
    return (
      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/60 px-5 py-4">
          <div>
            <p className="text-xs font-extrabold text-primary">
              Vocabulary
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-extrabold">
              <Icon name="book" size={18} />
              {t.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
              {items.length}
              {t.countSuffix}
            </span>
            <Link
              href={href("/review")}
              className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Icon name="bookmark" size={13} />
              {t.notebook}
            </Link>
          </div>
        </div>

        <ul className="grid gap-3 p-4 md:grid-cols-2">
          {items.map((v, i) => {
            const key = vocabKey(v.word, v.reading);
            const saved = canSave && isVocabSaved(state, v);
            const stat = stats.get(key);
            const delta = (saved ? 1 : 0) - (savedAtLoad.has(key) ? 1 : 0);
            const savedCount = Math.max(0, (stat?.saved_count ?? 0) + delta);
            const popular = savedCount >= 5;
            return (
              <li
                key={`${v.word}-${i}`}
                className="group relative min-w-0 rounded-2xl border border-border bg-surface/45 p-4 transition-colors hover:border-primary/25 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p lang="ja" className="text-lg font-black leading-tight text-fg">
                      {v.word}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span lang="ja" className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-extrabold text-primary">
                        {v.reading}
                      </span>
                      <span className="text-sm font-semibold leading-5 text-fg/85">
                        {v.meaning}
                      </span>
                    </div>
                  </div>

                  {(canSave || savedCount > 0) && (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {canSave ? (
                        <button
                          type="button"
                          onClick={() => toggleSavedVocab(v, lessonId)}
                          aria-pressed={saved}
                          title={saved ? t.remove : t.save}
                          className={[
                            "focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-bold tabular-nums transition-colors",
                            saved
                              ? "bg-primary/10 text-primary"
                              : "bg-card text-muted hover:text-primary",
                          ].join(" ")}
                        >
                          <Icon name="bookmark" size={14} filled={saved} />
                          {savedCount > 0 && savedCount}
                        </button>
                      ) : (
                        <span
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-bold tabular-nums text-muted"
                          title={t.savedByCount(savedCount)}
                        >
                          <Icon name="bookmark" size={14} />
                          {savedCount}
                        </span>
                      )}
                      {popular && (
                        <span className="rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--warning)]">
                          {t.popular}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-border/70 pt-3">
                  <p lang="ja" className="text-sm font-semibold leading-6 text-fg/85">
                    {v.example_ja}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{v.example_vi}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/70 px-5 py-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="book" size={18} />
          {t.title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
            {items.length}
            {t.countSuffix}
          </span>
          <Link
            href={href("/review")}
            className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Icon name="bookmark" size={13} />
            {t.notebook}
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((v, i) => {
          const key = vocabKey(v.word, v.reading);
          const saved = canSave && isVocabSaved(state, v);
          const stat = stats.get(key);
          // Server count, adjusted for the current user's own (optimistic) toggle.
          const delta = (saved ? 1 : 0) - (savedAtLoad.has(key) ? 1 : 0);
          const savedCount = Math.max(0, (stat?.saved_count ?? 0) + delta);
          const popular = savedCount >= 5;
          return (
            <li key={`${v.word}-${i}`} className="flex items-start gap-3 px-4 py-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                <div className="sm:w-[42%] sm:shrink-0">
                  <p lang="ja" className="font-extrabold leading-tight text-fg">
                    {v.word}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    <span lang="ja" className="text-xs font-semibold text-primary">
                      {v.reading}
                    </span>
                    <span className="text-sm text-fg/85">{v.meaning}</span>
                  </p>
                </div>
                <div className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-4">
                  <p lang="ja" className="text-xs leading-5 text-muted">
                    {v.example_ja}
                  </p>
                  <p className="text-xs leading-5 text-muted">{v.example_vi}</p>
                </div>
              </div>

              <div className="flex w-16 shrink-0 flex-col items-end gap-1">
                {(canSave || savedCount > 0) && (
                  <div className="inline-flex h-8 items-center overflow-hidden rounded-full border border-border bg-surface text-xs font-bold tabular-nums">
                    {canSave ? (
                      <button
                        type="button"
                        onClick={() => toggleSavedVocab(v, lessonId)}
                        aria-pressed={saved}
                        title={saved ? t.remove : t.save}
                        className={[
                          "focus-ring flex h-full items-center gap-1.5 px-2.5 transition-colors",
                          saved
                            ? "bg-primary/10 text-primary"
                            : "text-muted hover:text-primary",
                        ].join(" ")}
                      >
                        <Icon name="bookmark" size={14} filled={saved} />
                        {savedCount > 0 && savedCount}
                      </button>
                    ) : (
                      <span
                        className="flex h-full items-center gap-1.5 px-2.5 text-muted"
                        title={t.savedByCount(savedCount)}
                      >
                        <Icon name="bookmark" size={14} />
                        {savedCount}
                      </span>
                    )}
                  </div>
                )}
                {popular && (
                  <span className="rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--warning)]">
                    {t.popular}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

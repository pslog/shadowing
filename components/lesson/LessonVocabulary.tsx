"use client";

import Link from "next/link";
import type { VocabEntry } from "@/lib/types";
import { useData } from "@/lib/store/DataProvider";
import { isVocabSaved } from "@/lib/store/selectors";
import { Icon } from "@/components/ui/icon";

/**
 * Vocabulary section at the bottom of the lesson detail. Compact static rows:
 * word · reading · meaning on top, the situational example in small text.
 * Logged-in users can bookmark a word into their review notebook (/review).
 * Renders nothing when the lesson has no vocabulary generated yet.
 */
export function LessonVocabulary({
  vocabulary,
  lessonId,
}: {
  vocabulary: VocabEntry[] | null;
  lessonId: string;
}) {
  const { state, toggleSavedVocab } = useData();
  const items = vocabulary ?? [];
  const canSave = Boolean(state.profile);
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/70 px-5 py-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="book" size={18} />
          重要語彙
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
            {items.length}語
          </span>
          <Link
            href="/review"
            className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Icon name="bookmark" size={13} />
            単語帳
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((v, i) => {
          const saved = canSave && isVocabSaved(state, v);
          return (
            <li
              key={`${v.word}-${i}`}
              className="flex items-start gap-3 px-4 py-2"
            >
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

              {canSave && (
                <button
                  type="button"
                  onClick={() => toggleSavedVocab(v, lessonId)}
                  aria-pressed={saved}
                  title={saved ? "単語帳から削除" : "単語帳に保存"}
                  className={[
                    "focus-ring mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                    saved
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface hover:text-primary",
                  ].join(" ")}
                >
                  <Icon name="bookmark" size={17} filled={saved} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

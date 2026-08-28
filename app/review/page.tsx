"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { lessonById, lessonHref, savedVocabList, vocabKey } from "@/lib/store/selectors";
import { createClient } from "@/lib/supabase/client";
import { speakJa } from "@/lib/speech/tts";
import type { SavedVocab } from "@/lib/types";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/i18n/useI18n";
import { emitCompanionEvent } from "@/lib/gamification/companion-events";
import type { Dictionary } from "@/lib/i18n";
import { VocabularyBookLibrary } from "@/components/review/VocabularyBookLibrary";

type Filter = "all" | "unlearned" | "learned";

interface VocabStat {
  saved_count: number;
  learned_count: number;
}

export default function ReviewPage() {
  const { state, ready, setVocabLearned, removeSavedVocab } = useData();
  const { dictionary, href, locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const t = dictionary.review;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [deck, setDeck] = useState<SavedVocab[] | null>(null);
  const isNotebookPage = pathname?.endsWith("/review/my-book") ?? false;

  const all = savedVocabList(state);
  const learnedCount = all.filter((v) => v.learned).length;

  // Marking a word learned is a small win, and clearing the last one is a real
  // one — both worth a word from the companion. Unlearning is silent: undoing
  // something should not be congratulated.
  function markLearned(id: string, learned: boolean) {
    setVocabLearned(id, learned);
    if (!learned) return;
    emitCompanionEvent({ kind: "vocab", left: Math.max(0, all.length - learnedCount - 1) });
  }

  // Cross-user popularity per word (saved / learned counts).
  const [stats, setStats] = useState<Map<string, VocabStat>>(new Map());
  const wordsKey = all.map((v) => v.word).join("|");
  useEffect(() => {
    if (all.length === 0) return;
    let cancelled = false;
    const words = [...new Set(all.map((v) => v.word))];
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
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordsKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((v) => {
      if (filter === "learned" && !v.learned) return false;
      if (filter === "unlearned" && v.learned) return false;
      if (!q) return true;
      return (
        v.word.toLowerCase().includes(q) ||
        v.reading.toLowerCase().includes(q) ||
        v.meaning.toLowerCase().includes(q)
      );
    });
  }, [all, filter, query]);

  if (!ready) return <FullScreenLoading />;

  if (deck) {
    return (
      <AppShell>
        <Flashcards
          deck={deck}
          onExit={() => setDeck(null)}
          onLearned={markLearned}
          t={t}
        />
      </AppShell>
    );
  }

  if (!isNotebookPage) {
    return (
      <AppShell>
        <VocabularyBookLibrary
          locale={locale}
          signedIn={Boolean(state.profile)}
          profileId={state.profile?.id ?? null}
          savedCount={all.length}
          onOpenNotebook={() => router.push(href("/review/my-book"))}
          onLogin={() => window.location.assign(href("/login"))}
        />
      </AppShell>
    );
  }

  if (!state.profile) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold">{t.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.guestBody}</p>
          <Link href={href("/login")} className={`${buttonClasses("primary")} mt-5`}>
            {dictionary.common.login}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.push(href("/review"))}
          className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg"
        >
          <Icon name="arrow-left" size={16} />
          {locale === "ja" ? "単語帳一覧" : "Tất cả sổ từ vựng"}
        </button>
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card p-5 shadow-[var(--shadow-md)] sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
                <Icon name="bookmark" size={24} filled />
                {t.title}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {t.summary(all.length, learnedCount)}
              </p>
            </div>
            {all.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    setDeck(
                      all.filter((v) => !v.learned).length
                        ? all.filter((v) => !v.learned)
                        : all,
                    )
                  }
                >
                  <Icon name="play" size={16} />
                  {t.reviewUnlearned}
                </Button>
                <Button variant="secondary" onClick={() => setDeck(all)}>
                  {t.reviewAll}
                </Button>
              </div>
            )}
          </div>
        </section>

        {all.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <p className="text-sm">
              {t.emptyBody}{" "}
              <span className="font-semibold text-fg">{t.emptyHighlight}</span>{" "}
              {t.emptyTail}
            </p>
            <Link href={href("/courses")} className={`${buttonClasses("primary")} mt-4`}>
              {t.goToLessons}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1.5">
                {(
                  [
                    ["all", t.filterAll(all.length)],
                    ["unlearned", t.filterUnlearned(all.length - learnedCount)],
                    ["learned", t.filterLearned(learnedCount)],
                  ] as [Filter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={[
                      "focus-ring rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                      filter === key
                        ? "brand-gradient text-white shadow-[var(--shadow-glow)]"
                        : "border border-border bg-surface text-muted hover:text-fg",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="focus-ring h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm sm:w-56"
              />
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-[1.5rem] border border-border bg-card">
              {filtered.map((v) => (
                <VocabRow
                  key={v.id}
                  item={v}
                  stat={stats.get(vocabKey(v.word, v.reading))}
                  lessonHrefFor={(id) => {
                    const lesson = id ? lessonById(state, id) : undefined;
                    return lesson ? lessonHref(lesson) : null;
                  }}
                  onToggleLearned={() => markLearned(v.id, !v.learned)}
                  onRemove={() => removeSavedVocab(v.id)}
                  t={t}
                  localizedHref={href}
                />
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted">
                  {t.noMatch}
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}

function VocabRow({
  item,
  stat,
  lessonHrefFor,
  onToggleLearned,
  onRemove,
  t,
  localizedHref,
}: {
  item: SavedVocab;
  stat?: VocabStat;
  lessonHrefFor: (lessonId: string | null) => string | null;
  onToggleLearned: () => void;
  onRemove: () => void;
  t: Dictionary["review"];
  localizedHref: (href: string) => string;
}) {
  const href = lessonHrefFor(item.lesson_id);
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <div className="sm:w-[38%] sm:shrink-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span lang="ja" className="font-extrabold leading-tight text-fg">
              {item.word}
            </span>
            {item.learned && (
              <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--success)]">
                {t.learnedTag}
              </span>
            )}
            {stat && stat.saved_count > 0 && (
              <span className="inline-flex items-center gap-2 text-[11px] text-muted">
                <span
                  className="inline-flex items-center gap-1"
                  title={t.savedByCount(stat.saved_count)}
                >
                  <Icon name="bookmark" size={11} />
                  {stat.saved_count}
                </span>
                {stat.learned_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[var(--success)]"
                    title={t.learnedByCount(stat.learned_count)}
                  >
                    <Icon name="check" size={11} />
                    {stat.learned_count}
                  </span>
                )}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span lang="ja" className="text-xs font-semibold text-primary">
              {item.reading}
            </span>
            <span className="text-sm text-fg/85">{item.meaning}</span>
          </p>
          {href && (
            <Link
              href={localizedHref(href)}
              className="mt-0.5 inline-flex text-[11px] font-semibold text-primary hover:underline"
            >
              {t.openLesson}
            </Link>
          )}
        </div>
        <div className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-4">
          <p lang="ja" className="text-xs leading-5 text-muted">
            {item.example_ja}
          </p>
          <p className="text-xs leading-5 text-muted">{item.example_vi}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggleLearned}
          title={item.learned ? t.markUnlearned : t.markLearned}
          className={[
            "focus-ring grid h-8 w-8 place-items-center rounded-lg transition-colors",
            item.learned
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "text-muted hover:bg-surface hover:text-[var(--success)]",
          ].join(" ")}
        >
          <Icon name="check" size={16} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title={t.remove}
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
    </li>
  );
}

function Flashcards({
  deck,
  onExit,
  onLearned,
  t,
}: {
  deck: SavedVocab[];
  onExit: () => void;
  onLearned: (id: string, learned: boolean) => void;
  t: Dictionary["review"];
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  const card = deck[index];
  const total = deck.length;

  function next(markLearned: boolean) {
    if (markLearned) onLearned(card.id, true);
    setDone((d) => d + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (!card) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
          <Icon name="trophy" size={28} filled />
        </div>
        <h1 className="mt-4 text-xl font-extrabold">{t.deckDoneTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.deckDoneBody(done, total)}</p>
        <Button onClick={onExit} className="mt-5">
          {t.backToNotebook}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-muted hover:text-fg"
        >
          {t.backShort}
        </button>
        <span className="text-sm font-bold tabular-nums text-muted">
          {index + 1} / {total}
        </span>
      </div>

      <button
        key={index}
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? t.flipToWord : t.flipToMeaning}
        className="card-enter focus-ring block w-full"
        style={{ perspective: "1400px" }}
      >
        <div
          className="flashcard-flip relative h-72 w-full"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front: the word */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-6 text-center shadow-[var(--shadow-md)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px brand-gradient" />
            <span className="absolute right-4 top-3 text-[11px] font-bold uppercase tracking-widest text-muted">
              {t.faceWord}
            </span>
            <p lang="ja" className="text-4xl font-extrabold text-fg">
              {card.word}
            </p>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                speakJa(card.word);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  speakJa(card.word);
                }
              }}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-bold text-primary"
            >
              <Icon name="volume" size={14} />
              {t.listen}
            </span>
            <p className="mt-3 text-xs text-muted">{t.tapToFlip}</p>
          </div>

          {/* Back: reading, meaning, example */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-6 text-center shadow-[var(--shadow-md)]"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="absolute right-4 top-3 text-[11px] font-bold uppercase tracking-widest text-muted">
              {t.faceMeaning}
            </span>
            <p lang="ja" className="text-lg font-bold text-primary">
              {card.reading}
            </p>
            <p className="text-xl font-extrabold text-fg">{card.meaning}</p>
            <div className="mt-1 rounded-xl border border-border bg-surface/70 px-3 py-2 text-left">
              <p lang="ja" className="text-sm font-semibold leading-6 text-fg">
                {card.example_ja}
              </p>
              <p className="text-xs leading-5 text-muted">{card.example_vi}</p>
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => next(false)} className="flex-1">
          <Icon name="retry" size={16} />
          {t.notLearned}
        </Button>
        <Button onClick={() => next(true)} className="flex-1">
          <Icon name="check" size={16} />
          {t.learned}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { speakJa } from "@/lib/speech/tts";
import { useI18n } from "@/components/i18n/useI18n";
import type {
  VocabularyBook,
  VocabularyBookEntry,
  VocabularyBookProgress,
} from "@/lib/types";

type Copy = {
  library: string;
  libraryBody: string;
  mine: string;
  mineBody: (count: number) => string;
  loginToOpen: string;
  openNotebook: string;
  cards: (count: number) => string;
  learn: string;
  loading: string;
  back: string;
  learned: string;
  notLearned: string;
  finish: string;
  next: string;
  listen: string;
  mnemonic: string;
  readings: string;
  vocabulary: string;
  contents: string;
  quickPractice: string;
  quickPracticeBody: string;
  quickComplete: string;
  correctAnswer: string;
  wrongAnswer: string;
  continue: string;
  quiz: string;
  tests: string;
  test: (index: number) => string;
  testComplete: string;
  quizBody: (count: number) => string;
  result: string;
  reviewAnswers: string;
  mondai1: string;
  mondai1Body: string;
  mondai2: string;
  mondai2Body: string;
  explanation: string;
  submit: string;
  retake: string;
  score: (correct: number, total: number) => string;
};

export const vocabularyBookCopy = {
  vi: {
    library: "Sổ từ vựng",
    libraryBody: "Chọn một sổ để học theo nhịp của bạn.",
    mine: "Sổ của bạn",
    mineBody: (count: number) => `${count} từ bạn đã lưu từ các bài học`,
    loginToOpen: "Đăng nhập để mở sổ",
    openNotebook: "Mở sổ",
    cards: (count: number) => `${count} thẻ`,
    learn: "Học flashcard",
    loading: "Đang tải sổ...",
    back: "Quay lại sổ",
    learned: "Đã thuộc",
    notLearned: "Chưa thuộc",
    finish: "Hoàn thành",
    next: "Thẻ tiếp",
    listen: "Nghe",
    mnemonic: "Cách nhớ",
    readings: "Cách đọc",
    vocabulary: "Từ vựng",
    contents: "Nội dung sổ",
    quickPractice: "Luyện nhanh",
    quickPracticeBody: "Từng câu một, sai sẽ quay lại để ôn thêm.",
    quickComplete: "Đã hoàn thành lượt luyện",
    correctAnswer: "Chính xác",
    wrongAnswer: "Chưa đúng",
    continue: "Câu tiếp",
    quiz: "Kiểm tra N2",
    quizBody: (count: number) => `${count} câu từ vựng trong bài kiểm tra này.`,
    result: "Kết quả",
    reviewAnswers: "Xem đáp án và giải thích",
    mondai1: "問題1 · Cách đọc",
    mondai1Body: "Chọn cách đọc đúng của từ Kanji.",
    mondai2: "問題2 · Cách viết",
    mondai2Body: "Chọn cách viết Kanji đúng của từ đã cho.",
    explanation: "Giải thích",
    submit: "Nộp bài",
    tests: "Danh sách bài kiểm tra",
    test: (index: number) => `Bài ${String(index).padStart(2, "0")}`,
    testComplete: "Đã hoàn thành",
    retake: "Làm lại",
    score: (correct: number, total: number) => `Đúng ${correct}/${total} câu`,
  },
  ja: {
    library: "単語帳",
    libraryBody: "学びたい一冊を選んで、あなたのペースで進めましょう。",
    mine: "あなたの単語帳",
    mineBody: (count: number) => `レッスンから保存した ${count} 語`,
    loginToOpen: "ログインして単語帳を開く",
    openNotebook: "単語帳を開く",
    cards: (count: number) => `${count} 枚`,
    learn: "フラッシュカードで学ぶ",
    loading: "単語帳を読み込んでいます...",
    back: "単語帳一覧に戻る",
    learned: "習得済み",
    notLearned: "未習得",
    finish: "完了",
    next: "次のカード",
    listen: "聞く",
    mnemonic: "覚え方",
    readings: "読み方",
    vocabulary: "語彙",
    contents: "目次",
    quickPractice: "クイック練習",
    quickPracticeBody: "1問ずつ答え、間違えた語はもう一度出題されます。",
    quickComplete: "練習を完了しました",
    correctAnswer: "正解です",
    wrongAnswer: "もう一度確認しましょう",
    continue: "次の問題",
    quiz: "N2チェック",
    quizBody: (count: number) => `このテストにある語彙から ${count} 問です。`,
    result: "結果",
    reviewAnswers: "答えと解説を見る",
    mondai1: "問題1　読み方",
    mondai1Body: "漢字の読み方として最もよいものを選びます。",
    mondai2: "問題2　表記",
    mondai2Body: "ひらがなで書かれた語の表記として最もよいものを選びます。",
    explanation: "解説",
    submit: "答え合わせ",
    tests: "テスト一覧",
    test: (index: number) => `テスト ${String(index).padStart(2, "0")}`,
    testComplete: "完了",
    retake: "もう一度",
    score: (correct: number, total: number) => `${total}問中 ${correct}問正解`,
  },
} satisfies Record<"vi" | "ja", Copy>;

export function VocabularyBookLibrary({
  locale,
  signedIn,
  profileId,
  savedCount,
  onOpenNotebook,
  onLogin,
}: {
  locale: "vi" | "ja";
  signedIn: boolean;
  profileId: string | null;
  savedCount: number;
  onOpenNotebook: () => void;
  onLogin: () => void;
}) {
  const copy = vocabularyBookCopy[locale];
  const router = useRouter();
  const { href } = useI18n();
  const [books, setBooks] = useState<VocabularyBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .then(async (client) => {
        if (!client) return [];
        const { data } = await client
          .from("vocabulary_books")
          .select("*")
          .eq("is_public", true)
          .order("order_index", { ascending: true });
        return (data ?? []) as VocabularyBook[];
      })
      .then((data) => {
        if (!cancelled) setBooks(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{copy.library}</h1>
          <p className="mt-1 text-sm text-muted">{copy.libraryBody}</p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <BookCover
          title={copy.mine}
          description={copy.mineBody(savedCount)}
          count={copy.cards(savedCount)}
          action={signedIn ? copy.openNotebook : copy.loginToOpen}
          mark={locale === "ja" ? "私" : "MY"}
          accent="#5168ad"
          onClick={signedIn ? onOpenNotebook : onLogin}
        />

        {loading ? (
          <div className="min-h-28 animate-pulse rounded-lg border border-border bg-surface" aria-label={copy.loading} />
        ) : (
          books.map((book) => (
            <BookCover
              key={book.id}
              title={book.title}
              description={book.description || ""}
              count={copy.cards(book.entry_count)}
              action={copy.learn}
              mark={book.level || "語"}
              accent={book.accent || "#9a596d"}
              onClick={() => router.push(href(`/review/books/${book.slug}`))}
            />
          ))
        )}
      </section>
    </div>
  );
}

function BookCover({
  title,
  description,
  count,
  action,
  mark,
  accent,
  onClick,
}: {
  title: string;
  description: string;
  count: string;
  action: string;
  mark: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group grid min-h-28 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border bg-card p-3 text-left shadow-[var(--shadow-sm)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[var(--shadow-md)]"
    >
      <span
        className="relative grid h-20 w-16 place-items-center overflow-hidden rounded-[4px] text-white shadow-sm"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      >
        <span className="absolute -right-1 -top-3 text-5xl font-bold leading-none text-white/15">{mark}</span>
        <Icon name="book" size={22} className="relative" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-extrabold leading-5 text-fg">{title}</span>
        <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted">{description}</span>
      </span>
      <span className="flex h-full flex-col items-end justify-between gap-2 py-1 text-xs font-bold">
        <span className="whitespace-nowrap text-muted">{count}</span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-primary">
          {action} <Icon name="arrow-right" size={14} />
        </span>
      </span>
    </button>
  );
}

type QuizItem = {
  kind: "reading" | "notation";
  word: string;
  reading: string;
  meaning: string;
  answer: string;
  choices: string[];
  explanation: string;
};

function buildChoices(answer: string, pool: string[], seed: number) {
  const choices = [answer];
  for (let offset = 1; choices.length < 4 && offset < pool.length; offset += 1) {
    const candidate = pool[(seed + offset * 3) % pool.length];
    if (candidate && !choices.includes(candidate)) choices.push(candidate);
  }
  return choices.sort((left, right) => left.localeCompare(right, "ja"));
}

function quizWordKey(word: string, reading: string) {
  return `${word}|${reading}`;
}

function QuizResultDialog({
  correct,
  total,
  copy,
  onClose,
}: {
  correct: number;
  total: number;
  copy: Copy;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocabulary-quiz-result-title"
      onClick={onClose}
    >
      <div
        className="animate-pop relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={copy.back}
          onClick={onClose}
          className="focus-ring absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <Icon name="plus" size={18} className="rotate-45" />
        </button>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name={percentage === 100 ? "trophy" : "target"} size={27} />
        </div>
        <p className="mt-4 text-sm font-bold text-muted">{copy.result}</p>
        <h2 id="vocabulary-quiz-result-title" className="mt-1 text-3xl font-extrabold text-fg">
          {copy.score(correct, total)}
        </h2>
        <p className="mt-1 text-sm text-muted">{percentage}%</p>
        <Button className="mt-6 w-full" onClick={onClose}>
          <Icon name="check" size={16} />
          {copy.reviewAnswers}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

type QuickPracticeItem = QuizItem;
type TestScope = { label: string; entryIds: string[] };

function QuickVocabularyPractice({
  entries,
  masteredWordKeys,
  copy,
  onBack,
  onProgress,
}: {
  entries: VocabularyBookEntry[];
  masteredWordKeys: Set<string>;
  copy: Copy;
  onBack: () => void;
  onProgress: (results: { wordKey: string; mastered: boolean }[]) => void;
}) {
  const initialItems = useMemo<QuickPracticeItem[]>(() => {
    const seen = new Set<string>();
    const words = entries.flatMap((entry) => entry.vocabulary).filter((word) => {
      const key = quizWordKey(word.word, word.reading);
      if (!word.word || !word.reading || !word.meaning || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const source = words.filter((word) => !masteredWordKeys.has(quizWordKey(word.word, word.reading)));
    const selected = (source.length >= 4 ? source : words).slice(0, Math.min(10, words.length));
    const readings = words.map((word) => word.reading);
    const notations = words.map((word) => word.word);
    return selected.map((word, index) => {
      const kind = index % 2 === 0 ? "reading" as const : "notation" as const;
      const answer = kind === "reading" ? word.reading : word.word;
      return {
        kind,
        word: word.word,
        reading: word.reading,
        meaning: word.meaning,
        answer,
        choices: buildChoices(answer, kind === "reading" ? readings : notations, index),
        explanation: copy.explanation === "Giải thích"
          ? `「${word.word}」 đọc là 「${word.reading}」, nghĩa là “${word.meaning}”.`
          : `「${word.word}」の読み方は「${word.reading}」です。意味は「${word.meaning}」です。`,
      };
    });
  }, [copy, entries, masteredWordKeys]);
  const [sessionItems] = useState<QuickPracticeItem[]>(() => initialItems);
  const [queue, setQueue] = useState<QuickPracticeItem[]>(() => sessionItems);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const question = queue[0];
  const isCorrect = selected === question?.answer;

  function answer(choice: string) {
    if (!question || selected) return;
    const mastered = choice === question.answer;
    setSelected(choice);
    if (mastered) setCorrectCount((current) => current + 1);
    onProgress([{ wordKey: quizWordKey(question.word, question.reading), mastered }]);
  }

  function next() {
    if (!question || !selected) return;
    setQueue((current) => {
      const [, ...rest] = current;
      return isCorrect ? rest : [...rest, question];
    });
    setSelected(null);
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <Icon name="check" size={28} />
        </div>
        <h1 className="mt-4 text-xl font-extrabold">{copy.quickComplete}</h1>
        <p className="mt-2 text-sm text-muted">{copy.score(correctCount, sessionItems.length)}</p>
        <Button variant="secondary" onClick={onBack} className="mt-5"><Icon name="arrow-left" size={16} />{copy.contents}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
        <Icon name="arrow-left" size={16} /> {copy.contents}
      </button>
      <div className="mt-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-muted">
          <span>{question.kind === "reading" ? copy.mondai1 : copy.mondai2}</span>
          <span className="tabular-nums">{Math.min(correctCount + 1, sessionItems.length)} / {sessionItems.length}</span>
        </div>
        <p className="mt-7 text-center text-4xl font-extrabold text-fg" lang="ja">
          {question.kind === "reading" ? question.word : question.reading}
        </p>
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {question.choices.map((choice) => {
            const chosen = selected === choice;
            const tone = selected
              ? choice === question.answer
                ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                : chosen
                  ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "border-border text-muted"
              : "border-border text-fg hover:border-primary/35 hover:bg-surface";
            return <button key={choice} type="button" disabled={Boolean(selected)} onClick={() => answer(choice)} className={`focus-ring min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-default ${tone}`}>{choice}</button>;
          })}
        </div>
        {selected && (
          <div className={`mt-5 rounded-lg border p-4 text-sm leading-6 ${isCorrect ? "border-[var(--success)]/30 bg-[var(--success-soft)]" : "border-[var(--danger)]/25 bg-[var(--danger-soft)]"}`}>
            <p className={`font-extrabold ${isCorrect ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{isCorrect ? copy.correctAnswer : copy.wrongAnswer}</p>
            <p className="mt-1 text-muted">{question.explanation}</p>
          </div>
        )}
        {selected && <Button onClick={next} className="mt-5 w-full"><Icon name="arrow-right" size={16} />{copy.continue}</Button>}
      </div>
    </div>
  );
}

function VocabularyTestList({
  entries,
  masteredWordKeys,
  copy,
  onBack,
  onOpen,
}: {
  entries: VocabularyBookEntry[];
  masteredWordKeys: Set<string>;
  copy: Copy;
  onBack: () => void;
  onOpen: (scope: TestScope) => void;
}) {
  const scopes = useMemo(() => {
    return Array.from({ length: Math.ceil(entries.length / 50) }, (_, index) => {
      const group = entries.slice(index * 50, index * 50 + 50);
      const first = group[0]?.order_index ?? 0;
      const last = group.at(-1)?.order_index ?? first;
      return { label: `${first} - ${last}`, entryIds: group.map((entry) => entry.id) };
    });
  }, [entries]);

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
        <Icon name="arrow-left" size={16} /> {copy.contents}
      </button>
      <div className="mt-5">
        <h1 className="text-2xl font-extrabold">{copy.quiz}</h1>
        <p className="mt-1 text-sm text-muted">{copy.tests}</p>
      </div>
      <ol className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        {scopes.map((scope, index) => {
          const scopeEntries = entries.filter((entry) => scope.entryIds.includes(entry.id));
          const words = scopeEntries.flatMap((entry) => entry.vocabulary).filter((word) => word.word && word.reading && word.meaning);
          const complete = words.length > 0 && words.every((word) => masteredWordKeys.has(quizWordKey(word.word, word.reading)));
          return (
            <li key={index} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => onOpen(scope)} className="focus-ring flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-fg">Kanji {scope.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{scopeEntries.length} Kanji · {words.length} {copy.vocabulary.toLowerCase()}</span>
                </span>
                {complete ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--success)]"><Icon name="check" size={15} />{copy.testComplete}</span>
                ) : <Icon name="chevron-right" size={18} className="text-muted" />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function VocabularyQuiz({
  entries,
  masteredWordKeys,
  scope,
  copy,
  onBack,
  onSubmitted,
}: {
  entries: VocabularyBookEntry[];
  masteredWordKeys: Set<string>;
  scope: TestScope;
  copy: Copy;
  onBack: () => void;
  onSubmitted: (results: { wordKey: string; mastered: boolean }[]) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [activeMasteredWords, setActiveMasteredWords] = useState(() => new Set(masteredWordKeys));
  const [pendingMasteredWords, setPendingMasteredWords] = useState(() => new Set(masteredWordKeys));
  const items = useMemo<QuizItem[]>(() => {
    const seen = new Set<string>();
    const words = entries
      .filter((entry) => scope.entryIds.includes(entry.id))
      .flatMap((entry) => entry.vocabulary)
      .filter((word) => {
        const key = `${word.word}|${word.reading}`;
        if (!word.word || !word.reading || !word.meaning || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const unmasteredWords = words.filter((word) => !activeMasteredWords.has(quizWordKey(word.word, word.reading)));
    const sourceWords = unmasteredWords.length >= 2 ? unmasteredWords : words;
    const selectedWords = sourceWords
      .map((word, index) => ({ word, order: (index * 13 + attempt * 7) % sourceWords.length }))
      .sort((left, right) => left.order - right.order)
      .slice(0, Math.min(10, words.length))
      .map(({ word }) => word);
    const count = Math.ceil(selectedWords.length / 2);
    const readingPool = words.map((word) => word.reading);
    const notationPool = words.map((word) => word.word);
    const readingItems = selectedWords.slice(0, count).map((word, index) => ({
      kind: "reading" as const,
      word: word.word,
      reading: word.reading,
      meaning: word.meaning,
      answer: word.reading,
      choices: buildChoices(word.reading, readingPool, index),
      explanation: copy.explanation === "Giải thích"
        ? `「${word.word}」 đọc là 「${word.reading}」, nghĩa là “${word.meaning}”.`
        : `「${word.word}」の読み方は「${word.reading}」です。意味は「${word.meaning}」です。`,
    }));
    const notationItems = selectedWords.slice(count).map((word, index) => {
      return {
        kind: "notation" as const,
        word: word.word,
        reading: word.reading,
        meaning: word.meaning,
        answer: word.word,
        choices: buildChoices(word.word, notationPool, index + count),
        explanation: copy.explanation === "Giải thích"
          ? `「${word.reading}」 được viết là 「${word.word}」, nghĩa là “${word.meaning}”.`
          : `「${word.reading}」は「${word.word}」と書きます。意味は「${word.meaning}」です。`,
      };
    });
    return [...readingItems, ...notationItems];
  }, [activeMasteredWords, attempt, copy, entries, scope]);
  const [answers, setAnswers] = useState<(string | null)[]>(() => items.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const correct = answers.reduce((total, answer, index) => total + Number(answer === items[index]?.answer), 0);
  const complete = answers.every(Boolean);

  function retake() {
    setAnswers(items.map(() => null));
    setSubmitted(false);
    setShowResult(false);
    setActiveMasteredWords(new Set(pendingMasteredWords));
    setAttempt((current) => current + 1);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
          <Icon name="arrow-left" size={16} /> {copy.contents}
        </button>
        {submitted && <span className="text-sm font-extrabold text-primary">{copy.score(correct, items.length)}</span>}
      </div>
      <div>
        <h1 className="text-2xl font-extrabold">Kanji {scope.label}</h1>
        <p className="mt-1 text-sm text-muted">{copy.quizBody(items.length)}</p>
      </div>
      {(["reading", "notation"] as const).map((kind) => {
        const sectionItems = items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.kind === kind);
        if (sectionItems.length === 0) return null;
        return (
          <section key={kind} className="space-y-3">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-extrabold text-fg">{kind === "reading" ? copy.mondai1 : copy.mondai2}</h2>
              <p className="mt-1 text-sm text-muted">{kind === "reading" ? copy.mondai1Body : copy.mondai2Body}</p>
            </div>
            <ol className="space-y-3">
              {sectionItems.map(({ item, index }) => {
          const answer = answers[index];
          return (
            <li key={`${item.word}-${index}`} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-bold text-fg">
                <span className="mr-2 text-muted">{index + 1}.</span>
                <span lang="ja" className="text-lg">{item.kind === "reading" ? item.word : item.reading}</span>
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.choices.map((choice) => {
                  const selected = answer === choice;
                  const isCorrect = choice === item.answer;
                  const tone = submitted
                    ? isCorrect
                      ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                      : selected
                        ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                        : "border-border text-muted"
                    : selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-fg hover:border-primary/35";
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((current) => current.map((value, itemIndex) => itemIndex === index ? choice : value))}
                      className={`focus-ring min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-default ${tone}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-3 border-t border-border pt-3 text-sm leading-6 text-muted">
                  <span className="mr-2 font-bold text-fg">{copy.explanation}</span>
                  {item.explanation}
                </p>
              )}
            </li>
          );
              })}
            </ol>
          </section>
        );
      })}
      {items.length > 0 && (
        <div className="flex justify-end gap-2">
          {submitted && <Button variant="secondary" onClick={retake}><Icon name="retry" size={16} />{copy.retake}</Button>}
          {!submitted && <Button disabled={!complete} onClick={() => {
            const results = items.map((item, index) => ({
              wordKey: quizWordKey(item.word, item.reading),
              mastered: answers[index] === item.answer,
            }));
            setPendingMasteredWords((current) => {
              const next = new Set(current);
              for (const result of results) {
                if (result.mastered) next.add(result.wordKey);
                else next.delete(result.wordKey);
              }
              return next;
            });
            onSubmitted(results);
            setSubmitted(true);
            setShowResult(true);
          }}><Icon name="check" size={16} />{copy.submit}</Button>}
        </div>
      )}
      {showResult && <QuizResultDialog correct={correct} total={items.length} copy={copy} onClose={() => setShowResult(false)} />}
    </div>
  );
}

export function VocabularyBookStudy({
  book,
  profileId,
  copy,
  onBack,
}: {
  book: VocabularyBook;
  profileId: string | null;
  copy: Copy;
  onBack: () => void;
}) {
  const [entries, setEntries] = useState<VocabularyBookEntry[]>([]);
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [masteredQuizWords, setMasteredQuizWords] = useState<Set<string>>(new Set());
  const [deck, setDeck] = useState<VocabularyBookEntry[] | null>(null);
  const [quickPracticeOpen, setQuickPracticeOpen] = useState(false);
  const [testListOpen, setTestListOpen] = useState(false);
  const [testScope, setTestScope] = useState<TestScope | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .then(async (client) => {
        if (!client) return { entries: [], progress: [] as VocabularyBookProgress[], quizProgress: [] as { word_key: string; mastered: boolean }[] };
        const { data: entryData } = await client
          .from("vocabulary_book_entries")
          .select("*")
          .eq("book_id", book.id)
          .order("order_index", { ascending: true });
        const nextEntries = (entryData ?? []) as VocabularyBookEntry[];
        if (!profileId || nextEntries.length === 0) return { entries: nextEntries, progress: [], quizProgress: [] };
        const [{ data: progressData }, { data: quizProgressData }] = await Promise.all([
          client
            .from("vocabulary_book_progress")
            .select("*")
            .eq("user_id", profileId)
            .in("entry_id", nextEntries.map((entry) => entry.id)),
          client
            .from("vocabulary_book_quiz_progress")
            .select("word_key, mastered")
            .eq("user_id", profileId)
            .eq("book_id", book.id)
            .eq("mastered", true),
        ]);
        return {
          entries: nextEntries,
          progress: (progressData ?? []) as VocabularyBookProgress[],
          quizProgress: (quizProgressData ?? []) as { word_key: string; mastered: boolean }[],
        };
      })
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setProgress(new Map(data.progress.map((item) => [item.entry_id, item.learned])));
        setMasteredQuizWords(new Set(data.quizProgress.map((item) => item.word_key)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id, profileId]);

  const card = deck?.[index];
  const learnedCount = useMemo(
    () => [...progress.values()].filter(Boolean).length,
    [progress],
  );

  async function setLearned(learned: boolean) {
    if (!card) return;
    setProgress((current) => new Map(current).set(card.id, learned));
    if (profileId) {
      const client = await createClient();
      await client
        ?.from("vocabulary_book_progress")
        .upsert(
          { user_id: profileId, entry_id: card.id, learned, updated_at: new Date().toISOString() },
          { onConflict: "user_id,entry_id" },
        );
    }
  }

  async function saveQuizProgress(results: { wordKey: string; mastered: boolean }[]) {
    const nextMasteredWords = new Set(masteredQuizWords);
    for (const result of results) {
      if (result.mastered) nextMasteredWords.add(result.wordKey);
      else nextMasteredWords.delete(result.wordKey);
    }
    setMasteredQuizWords((current) => {
      const next = new Set(current);
      for (const result of results) {
        if (result.mastered) next.add(result.wordKey);
        else next.delete(result.wordKey);
      }
      return next;
    });
    const newlyLearnedEntries = entries.filter((entry) => {
      const wordKeys = [...new Set(entry.vocabulary
        .filter((word) => word.word && word.reading && word.meaning)
        .map((word) => quizWordKey(word.word, word.reading)))];
      return wordKeys.length > 0 && wordKeys.every((wordKey) => nextMasteredWords.has(wordKey));
    });
    if (newlyLearnedEntries.length > 0) {
      setProgress((current) => {
        const next = new Map(current);
        for (const entry of newlyLearnedEntries) next.set(entry.id, true);
        return next;
      });
    }
    if (!profileId || results.length === 0) return;
    const client = await createClient();
    await client?.from("vocabulary_book_quiz_progress").upsert(
      results.map((result) => ({
        user_id: profileId,
        book_id: book.id,
        word_key: result.wordKey,
        mastered: result.mastered,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,book_id,word_key" },
    );
    if (newlyLearnedEntries.length > 0) {
      await client?.from("vocabulary_book_progress").upsert(
        newlyLearnedEntries.map((entry) => ({
          user_id: profileId,
          entry_id: entry.id,
          learned: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,entry_id" },
      );
    }
  }

  function next() {
    setFlipped(false);
    setIndex((current) => Math.min(current + 1, deck?.length ?? 0));
  }

  function begin(nextDeck: VocabularyBookEntry[]) {
    if (nextDeck.length === 0) return;
    setIndex(0);
    setFlipped(false);
    setDeck(nextDeck);
  }

  if (loading) return <p className="py-10 text-sm text-muted">{copy.loading}</p>;

  if (quickPracticeOpen) {
    return <QuickVocabularyPractice entries={entries} masteredWordKeys={masteredQuizWords} copy={copy} onBack={() => setQuickPracticeOpen(false)} onProgress={saveQuizProgress} />;
  }

  if (testScope) {
    return <VocabularyQuiz entries={entries} masteredWordKeys={masteredQuizWords} scope={testScope} copy={copy} onBack={() => setTestScope(null)} onSubmitted={saveQuizProgress} />;
  }

  if (testListOpen) {
    return <VocabularyTestList entries={entries} masteredWordKeys={masteredQuizWords} copy={copy} onBack={() => setTestListOpen(false)} onOpen={setTestScope} />;
  }

  if (!deck) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
              <Icon name="arrow-left" size={16} /> {copy.back}
            </button>
            <h1 className="mt-3 text-2xl font-extrabold">{book.title}</h1>
            {book.description && <p className="mt-1 text-sm text-muted">{book.description}</p>}
          </div>
          <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-bold tabular-nums text-muted">
            {learnedCount}/{entries.length} {copy.learned}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-y border-border py-4">
          <Button onClick={() => setQuickPracticeOpen(true)}>
            <Icon name="target" size={16} />
            {copy.quickPractice}
          </Button>
          <Button variant="secondary" onClick={() => begin(entries)}>
            {copy.learn} ({entries.length})
          </Button>
          <Button variant="secondary" onClick={() => setTestListOpen(true)}>
            <Icon name="trophy" size={16} />
            {copy.quiz}
          </Button>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-muted">{copy.contents}</h2>
          <ul className="overflow-hidden rounded-lg border border-border bg-card">
            {entries.map((entry, entryIndex) => {
              const learned = progress.get(entry.id) ?? false;
              return (
                <li key={entry.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => begin(entries.slice(entryIndex))}
                    className="focus-ring flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface"
                  >
                    <span className="w-6 text-xs font-bold tabular-nums text-muted">{entry.order_index}</span>
                    <span lang="ja" className="w-10 text-2xl font-extrabold text-fg">{entry.kanji}</span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="block text-sm font-bold text-fg">{entry.meaning}</span>
                      <span lang="ja" className="mt-0.5 block text-xs text-primary">{entry.readings.join(" · ")}</span>
                      {entry.mnemonic && (
                        <span className="mt-1 block line-clamp-1 text-sm leading-5 text-muted">
                          {entry.mnemonic}
                        </span>
                      )}
                    </span>
                    <span className={learned ? "grid h-8 w-8 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]" : "grid h-8 w-8 place-items-center rounded-full border border-border text-muted"}>
                      <Icon name={learned ? "check" : "chevron-right"} size={16} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <Icon name="check" size={27} />
        </div>
        <h1 className="mt-4 text-xl font-extrabold">{copy.finish}</h1>
        <p className="mt-2 text-sm text-muted">
          {learnedCount}/{entries.length} {copy.learned.toLowerCase()}
        </p>
        <Button variant="secondary" onClick={() => { setDeck(null); setIndex(0); }} className="mt-5">
          <Icon name="arrow-left" size={16} />
          {copy.contents}
        </Button>
      </div>
    );
  }

  const learned = progress.get(card.id) ?? false;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => { setDeck(null); setIndex(0); }} className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
          <Icon name="arrow-left" size={16} /> {copy.contents}
        </button>
        <span className="text-sm font-bold tabular-nums text-muted">
          {index + 1} / {deck.length}
        </span>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setFlipped((value) => !value);
          }
        }}
        aria-label={card.kanji}
        className="focus-ring mt-6 block w-full text-left"
        style={{ perspective: "1400px" }}
      >
        <div className="flashcard-flip relative min-h-[27rem] w-full" style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-card p-7 text-center shadow-[var(--shadow-md)]" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
            <span className="absolute left-5 top-5 text-xs font-bold text-muted">{book.title}</span>
            <p lang="ja" className="text-8xl font-bold text-fg">{card.kanji}</p>
            <p className="mt-5 text-sm text-muted">{copy.learn}</p>
          </div>
          <div className="absolute inset-0 overflow-y-auto rounded-lg border border-primary/20 bg-card p-6 shadow-[var(--shadow-md)]" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p lang="ja" className="text-4xl font-extrabold text-fg">{card.kanji}</p>
                <p className="mt-1 text-sm font-bold text-primary">{card.meaning}</p>
              </div>
              <button type="button" onClick={(event) => { event.stopPropagation(); speakJa(card.kanji); }} className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary" aria-label={copy.listen}>
                <Icon name="volume" size={18} />
              </button>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              {card.readings.length > 0 && <div><dt className="text-xs font-bold text-muted">{copy.readings}</dt><dd className="mt-1 font-semibold text-fg">{card.readings.join(" · ")}</dd></div>}
              {card.structure && <div><dt className="text-xs font-bold text-muted">構造</dt><dd className="mt-1 font-semibold text-fg">{card.structure}</dd></div>}
              {card.mnemonic && <div className="sm:col-span-2"><dt className="text-xs font-bold text-muted">{copy.mnemonic}</dt><dd className="mt-1 leading-6 text-fg/85">{card.mnemonic}</dd></div>}
              {card.vocabulary.length > 0 && <div className="sm:col-span-2"><dt className="text-xs font-bold text-muted">{copy.vocabulary}</dt><dd className="mt-2 grid gap-1.5 sm:grid-cols-2">{card.vocabulary.map((word) => <span key={`${word.word}-${word.reading}`} className="rounded-md bg-surface px-2.5 py-2"><b lang="ja">{word.word}</b> <span lang="ja" className="text-primary">{word.reading}</span><span className="block mt-0.5 text-xs text-muted">{word.meaning}</span></span>)}</dd></div>}
            </dl>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setLearned(false)}><Icon name="retry" size={16} />{copy.notLearned}</Button>
        <Button onClick={async () => { await setLearned(true); next(); }}><Icon name="check" size={16} />{learned ? copy.next : copy.learned}</Button>
      </div>
    </div>
  );
}

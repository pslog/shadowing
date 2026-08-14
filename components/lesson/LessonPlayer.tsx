"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import {
  bestAttemptForSentence,
  courseById,
  courseHref as courseHrefOf,
  isAdmin,
  isSentencePassed,
  lessonHref,
  myAttemptsForSentence,
  passedCountForLesson,
  sentencesForLesson,
  lessonById,
  nextLessonInCourse,
  UNCATEGORIZED_COURSE_ID,
} from "@/lib/store/selectors";
import type { AttemptOutcome } from "@/lib/store/engine";
import { scoreSentence, estimateDurationSeconds } from "@/lib/client/score";
import { extractContourFromUrl, contourMetrics } from "@/lib/speech/pitch";
import { speakJa, cancelSpeech } from "@/lib/speech/tts";
import { isSpeechRecognitionSupported, type RecordResult } from "@/lib/speech/useRecorder";
import type {
  Lesson,
  LessonSentence,
  ScoreAlignmentToken,
  ScoreBreakdown,
  SentenceAttempt,
} from "@/lib/types";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Icon, type IconName } from "@/components/ui/icon";
import { AudioRecorder } from "./AudioRecorder";
import { isN2Course } from "@/lib/n2-course";
import { ScoreResult } from "./ScoreResult";
import { LessonReview } from "./LessonReview";
import { LessonVocabulary } from "./LessonVocabulary";
import { Furigana } from "./Furigana";
import { useI18n } from "@/components/i18n/useI18n";
import { emitCompanionEvent } from "@/lib/gamification/companion-events";
import {
  levelMascot,
  levelProgress,
  levelTitle,
  type Mascot as MascotIdentity,
} from "@/lib/gamification/level";
import { MascotBadge } from "@/components/ui/mascot";
import { getAnonymousSessionId } from "@/lib/anonymous-session";
import type { Dictionary, Locale } from "@/lib/i18n";

function attemptToScore(a: SentenceAttempt): ScoreBreakdown {
  return {
    pronunciation: a.pronunciation_score,
    speed: a.speed_score,
    coverage: a.coverage_score,
    intonation: a.intonation_score,
    total: a.total_score,
    passed: a.is_passed,
    feedback: a.feedback ?? "",
  };
}

interface FreshResult {
  score: ScoreBreakdown;
  outcome: AttemptOutcome;
  audioUrl: string | null;
  transcript: string;
}

interface LessonViewStats {
  totalViews: number;
  shadowingUsers: number;
}

interface ReadingLessonProps {
  lesson: NonNullable<ReturnType<typeof lessonById>>;
  sentences: LessonSentence[];
  courseHref: string;
  lessonViewStats: LessonViewStats | null;
}

interface ReadingCheckQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

const LESSON_VIEW_DEDUPE_MS = 2_000;
const recentLessonViewRecords = new Map<string, number>();
const readingProgressCache = new Map<string, boolean>();
const readingProgressPending = new Map<string, Promise<boolean>>();
const lessonViewStatsCache = new Map<string, LessonViewStats>();
const lessonViewStatsPending = new Map<string, Promise<LessonViewStats | null>>();

function readingWatermark(lesson: Lesson) {
  return lesson.reading_meta?.watermark ?? lesson.title.trim().charAt(0) ?? "読";
}

function readingMemo(lesson: Lesson, locale: Locale) {
  return lesson.reading_meta?.memo?.[locale] ?? lesson.reading_meta?.memo?.ja ?? null;
}

function buildReadingParagraphs(lesson: ReadingLessonProps["lesson"], sentences: LessonSentence[]) {
  const source = sentences.map((sentence) => sentence.ja_text);
  const makeParagraph = (start: number, end: number) => ({
    id: sentences[start]?.id ?? String(start),
    text: source.slice(start, end).join(""),
    author: false,
  });

  if (lesson.slug === "kanji-shiawase-dokuhon-yasashii" && sentences.length >= 17) {
    return [
      makeParagraph(0, 7),
      makeParagraph(7, 13),
      makeParagraph(13, 16),
      {
        id: sentences[16].id,
        text: sentences[16].ja_text,
        author: true,
      },
    ];
  }

  if (lesson.slug === "kanji-shiawase-dokuhon-daijoubu" && sentences.length >= 27) {
    return [
      makeParagraph(0, 3),
      {
        id: sentences[3].id,
        text: [
          ...source.slice(3, 6),
          source.slice(6, 9).join("\n"),
          ...source.slice(9, 12),
        ].join("\n"),
        author: false,
      },
      makeParagraph(12, 20),
      {
        id: sentences[20].id,
        text: [source[20], source[21], ...source.slice(22, 26)].join("\n"),
        author: false,
      },
      {
        id: sentences[26].id,
        text: sentences[26].ja_text,
        author: true,
      },
    ];
  }

  const paragraphs: { id: string; text: string; author: boolean }[] = [];
  let buffer: LessonSentence[] = [];

  for (const sentence of sentences) {
    if (sentence.ja_text.startsWith("☞") || sentence.ja_text.startsWith("―")) {
      if (buffer.length > 0) {
        paragraphs.push({
          id: buffer[0].id,
          text: buffer.map((item) => item.ja_text).join(""),
          author: false,
        });
        buffer = [];
      }
      paragraphs.push({ id: sentence.id, text: sentence.ja_text, author: true });
      continue;
    }

    buffer.push(sentence);
    if (buffer.length >= 4) {
      paragraphs.push({
        id: buffer[0].id,
        text: buffer.map((item) => item.ja_text).join(""),
        author: false,
      });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    paragraphs.push({
      id: buffer[0].id,
      text: buffer.map((item) => item.ja_text).join(""),
      author: false,
    });
  }

  return paragraphs;
}

function ReadingCheck({
  questions,
  onSubmitComplete,
}: {
  questions: ReadingCheckQuestion[];
  onSubmitComplete: (results: boolean[]) => void;
}) {
  const { locale } = useI18n();
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);
  const answered = answers.filter((answer) => answer != null).length;
  const score = answers.reduce<number>(
    (sum, answer, index) => sum + (answer === questions[index].answer ? 1 : 0),
    0,
  );
  const complete = answered === questions.length;
  const copy =
    locale === "vi"
      ? {
          eyebrow: "Reading check",
          title: "読解チェック",
          subtitle: "Chọn đáp án sau khi đọc xong để tự kiểm tra mức hiểu bài.",
          progress: "đã trả lời",
          correct: "Đúng",
          wrong: "Chưa đúng",
          answer: "正解",
          submit: "Nộp bài",
          submitHint: "Chọn đủ đáp án để nộp bài.",
          ready: "Đã chọn đủ đáp án. Nộp bài để xem kết quả.",
          retry: "Làm lại",
          result: "Kết quả",
        }
      : {
          eyebrow: "Reading check",
          title: "読解チェック",
          subtitle: "本文を読んだあと、内容を理解できたか確認しましょう。",
          progress: "回答済み",
          correct: "正解",
          wrong: "もう一度確認",
          answer: "正解",
          submit: "提出する",
          submitHint: "すべて選ぶと提出できます。",
          ready: "すべて選びました。提出すると結果を確認できます。",
          retry: "やり直す",
          result: "結果",
        };

  return (
    <section
      id="reading-check"
      className="scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-col gap-4 border-b border-border bg-surface/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-extrabold">
            <Icon name="check" size={18} className="text-primary" />
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">{copy.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted tabular-nums">
            {answered}/{questions.length} {copy.progress}
          </span>
          {submitted && (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary tabular-nums">
              {copy.result}: {score}/{questions.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {questions.map((question, questionIndex) => {
          const selected = answers[questionIndex];
          const revealed = submitted;
          const correct = selected === question.answer;
          return (
            <div
              key={question.question}
              className="rounded-2xl border border-border bg-surface/45 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary tabular-nums">
                  Q{questionIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p lang="ja" className="text-[0.95rem] font-extrabold leading-7 text-fg">
                    {question.question}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {question.choices.map((choice, choiceIndex) => {
                      const isSelected = selected === choiceIndex;
                      const isAnswer = question.answer === choiceIndex;
                      const tone = revealed
                        ? isAnswer
                          ? "border-[var(--success)]/50 bg-[var(--success-soft)] text-[var(--success)]"
                          : isSelected
                            ? "border-[var(--danger)]/45 bg-[var(--danger-soft)] text-[var(--danger)]"
                            : "border-border bg-card text-muted"
                        : isSelected
                          ? "border-primary/45 bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-primary/35 hover:bg-primary/5";
                      return (
                        <button
                          key={choice}
                          type="button"
                          disabled={submitted}
                          onClick={() =>
                            setAnswers((prev) =>
                              prev.map((item, index) =>
                                index === questionIndex ? choiceIndex : item,
                              ),
                            )
                          }
                          className={[
                            "focus-ring flex min-h-12 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors disabled:cursor-default",
                            tone,
                          ].join(" ")}
                        >
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-current/20 text-xs font-black">
                            {String.fromCharCode(65 + choiceIndex)}
                          </span>
                          <span lang="ja" className="leading-6">
                            {choice}
                          </span>
                          {revealed && isAnswer && (
                            <Icon name="check" size={16} className="ml-auto mt-1 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {revealed && (
                    <div
                      className={[
                        "mt-3 rounded-xl border px-3 py-2.5 text-sm leading-6",
                        correct
                          ? "border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success)]"
                          : "border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]",
                      ].join(" ")}
                    >
                      <p className="font-black">
                        {correct ? copy.correct : copy.wrong} · {copy.answer}:{" "}
                        {String.fromCharCode(65 + question.answer)}
                      </p>
                      <p className="mt-1 text-fg/80">{question.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-surface/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {!submitted ? (
          <>
            <p className="text-sm font-bold text-muted">
              {complete ? copy.ready : copy.submitHint}
            </p>
            <Button
              disabled={!complete}
              onClick={() => {
                setSubmitted(true);
                onSubmitComplete(
                  answers.map((answer, i) => answer === questions[i].answer),
                );
              }}
            >
              <Icon name="check" size={16} />
              {copy.submit}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-primary tabular-nums">
              {copy.result}: {score}/{questions.length}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers(questions.map(() => null));
                setSubmitted(false);
              }}
            >
              <Icon name="retry" size={16} />
              {copy.retry}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Shown once the comprehension check is submitted — at ANY score.
 *
 * Reading has no XP, no streak and no pass mark, so without this the learner
 * answers the questions and the page just sits there. This dialog is the only
 * moment reading gets to feel like an accomplishment, which is why a weak score
 * still opens it: what is being celebrated is finishing the passage, and the
 * score is reported underneath as information rather than as a verdict. The copy
 * shifts tone with the result but never scolds, and the mascot in the middle is
 * the learner's own level mascot — the same currency as the shadowing side, so
 * reading does not feel like the lesser half of the app.
 */
function ReadingCompleteDialog({
  results,
  locale,
  mascot,
  mascotTitle,
  nextHref,
  hasNext,
  onClose,
  onReview,
  localizedHref,
}: {
  results: boolean[];
  locale: Locale;
  mascot: MascotIdentity;
  mascotTitle: string;
  nextHref: string;
  hasNext: boolean;
  onClose: () => void;
  onReview: () => void;
  localizedHref: (href: string) => string;
}) {
  const primaryRef = useRef<HTMLAnchorElement | null>(null);
  const total = results.length;
  const correct = results.filter(Boolean).length;
  const tier = correct === total ? "perfect" : correct * 2 >= total ? "good" : "low";

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy =
    locale === "vi"
      ? {
          eyebrow: "Đọc hiểu",
          title: {
            perfect: "Đúng hết rồi!",
            good: "Làm tốt lắm!",
            low: "Bạn đã đọc hết bài!",
          }[tier],
          body: {
            perfect: "Bài này bạn nắm rất chắc. Giữ nhịp đọc này nhé!",
            good: "Đúng phần lớn rồi. Xem giải thích mấy câu còn lại là trọn vẹn.",
            low: "Kết quả chưa cao, nhưng bạn đã đi hết bài — đó mới là phần khó. Xem giải thích rồi đọc lại một lượt là khác ngay.",
          }[tier],
          resultLabel: "Kết quả",
          statusLabel: "Trạng thái",
          statusValue: "Đã đọc",
          questionShort: "Câu",
          review: "Xem giải thích",
          next: hasNext ? "Bài tiếp theo" : "Về khóa học",
        }
      : {
          eyebrow: "読解",
          title: {
            perfect: "全問正解！",
            good: "よくできました！",
            low: "本文を読み切りました！",
          }[tier],
          body: {
            perfect: "内容をしっかりつかめています。このペースで続けましょう！",
            good: "ほとんど正解です。残りの解説を読めば完璧です。",
            low: "点数はまだ伸ばせますが、最後まで読み切ったことが一番大事です。解説を見て、もう一度読んでみましょう。",
          }[tier],
          resultLabel: "結果",
          statusLabel: "状態",
          statusValue: "読了",
          questionShort: "問",
          review: "解説を見る",
          next: hasNext ? "次のレッスン" : "コースへ戻る",
        };

  // One ring, three tones: full marks reads as success, a decent score as brand
  // colour, a weak one as a warning — never as an error. Nothing here failed.
  const tone =
    tier === "perfect"
      ? "var(--success)"
      : tier === "good"
        ? "var(--primary)"
        : "var(--warning)";
  const RADIUS = 34;
  const circumference = 2 * Math.PI * RADIUS;
  const offset = circumference * (1 - correct / Math.max(1, total));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-complete-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop relative m-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border bg-card p-5 text-center shadow-[var(--shadow-lg)] sm:p-6"
        style={{ borderColor: `color-mix(in srgb, ${tone} 28%, transparent)` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full blur-3xl"
          style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)` }}
        />

        <div className="relative">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">
            {copy.eyebrow}
          </p>

          {/* Score ring around the level mascot: the number and the thing it
              feeds land as one object instead of two separate widgets. */}
          <div className="relative mx-auto mt-3 grid h-24 w-24 place-items-center">
            <svg
              viewBox="0 0 80 80"
              aria-hidden
              className="absolute inset-0 h-full w-full -rotate-90"
            >
              <circle
                cx="40"
                cy="40"
                r={RADIUS}
                fill="none"
                strokeWidth="6"
                className="stroke-border"
              />
              <circle
                cx="40"
                cy="40"
                r={RADIUS}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="animate-ring-draw"
                style={
                  {
                    stroke: tone,
                    strokeDasharray: circumference,
                    "--ring-len": `${circumference}`,
                    "--ring-off": `${offset}`,
                  } as React.CSSProperties
                }
              />
            </svg>
            <MascotBadge slug={mascot.slug} accent={mascot.accent} size={58} />
          </div>

          <h2 id="reading-complete-title" className="mt-4 text-2xl font-extrabold text-fg">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{copy.body}</p>

          {/* Per-question dots: which ones to go back to, without a table. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {results.map((ok, i) => (
              <span
                key={i}
                title={`${copy.questionShort} ${i + 1}`}
                className={[
                  "grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums",
                  ok
                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "bg-[var(--warning-soft)] text-[var(--warning)]",
                ].join(" ")}
              >
                {ok ? <Icon name="check" size={13} /> : i + 1}
              </span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-surface px-3 py-2">
              <p className="text-xs font-bold text-muted">{copy.resultLabel}</p>
              <p
                className="mt-0.5 text-lg font-extrabold tabular-nums"
                style={{ color: tone }}
              >
                {correct}/{total}
              </p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-2">
              <p className="text-xs font-bold text-muted">{copy.statusLabel}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-lg font-extrabold text-[var(--success)]">
                <Icon name="check" size={16} />
                {copy.statusValue}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-muted">{mascotTitle}</p>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              ref={primaryRef}
              href={localizedHref(nextHref)}
              className={`${buttonClasses("primary")} w-full`}
            >
              {copy.next}
              <Icon name="arrow-right" size={16} />
            </Link>
            <Button variant="secondary" onClick={onReview} className="w-full">
              {copy.review}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReadingLesson({
  lesson,
  sentences,
  courseHref,
  lessonViewStats,
}: ReadingLessonProps) {
  const { state, usingSupabase, markReadingLessonRead } = useData();
  const { locale, dictionary: m, href } = useI18n();
  const [dbRead, setDbRead] = useState(false);
  /** Per-question results of the submitted check; non-null opens the dialog. */
  const [checkResults, setCheckResults] = useState<boolean[] | null>(null);
  const copy =
    locale === "vi"
      ? {
          label: "Đọc hiểu",
          read: "Đã đọc",
          unread: "Chưa đọc",
          intro:
            "Đọc chậm theo từng đoạn, giữ mạch văn tự nhiên rồi xem lại từ vựng ở cuối bài.",
          article: "本文",
          articleHint: "Đọc liền mạch, chú ý cách chữ Hán mở nghĩa trong câu chuyện.",
          blocks: "đoạn",
          back: "Về khóa học",
        }
      : {
          label: "読解",
          read: "読了",
          unread: "未読",
          intro:
            "段落ごとにゆっくり読み、文章の流れと漢字に込められた意味を味わいます。下の語彙も確認しましょう。",
          article: "本文",
          articleHint: "文章の流れと漢字に込められた意味を味わいながら読みましょう。",
          blocks: "段落",
          back: "コースへ戻る",
        };
  const paragraphs = buildReadingParagraphs(lesson, sentences);
  const readingCheck = lesson.reading_meta?.readingCheck;
  const watermark = readingWatermark(lesson);
  const readingNote = readingMemo(lesson, locale);
  const progressRead = state.progress.some(
    (progress) => progress.lesson_id === lesson.id && progress.status === "completed",
  );
  const isRead = progressRead || dbRead;

  useEffect(() => {
    if (!usingSupabase) return;
    let cancelled = false;
    const anonymousSessionId = getAnonymousSessionId();
    const cacheKey = `${anonymousSessionId}:${lesson.id}`;
    const cached = readingProgressCache.get(cacheKey);
    if (typeof cached === "boolean") {
      setDbRead(cached);
      return;
    }

    const timeout = window.setTimeout(() => {
      const pending =
        readingProgressPending.get(cacheKey) ??
        fetch(
          `/api/reading-progress?lessonIds=${encodeURIComponent(
            lesson.id,
          )}&anonymousSessionId=${encodeURIComponent(anonymousSessionId)}`,
          { cache: "no-store" },
        )
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) =>
            Boolean(
              payload?.lessons?.some(
                (item: { lessonId?: string }) => item.lessonId === lesson.id,
              ),
            ),
          )
          .finally(() => readingProgressPending.delete(cacheKey));

      readingProgressPending.set(cacheKey, pending);
      pending
        .then((read) => {
          readingProgressCache.set(cacheKey, read);
          if (!cancelled) setDbRead(read);
        })
        .catch(() => {
          if (!cancelled) setDbRead(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [lesson.id, usingSupabase]);

  const markRead = (results: boolean[]) => {
    const firstRead = !isRead;
    setDbRead(true);
    setCheckResults(results);
    markReadingLessonRead(lesson.id);
    // Reading has its own companion vocabulary: no takes, no pass score, so the
    // comprehension result is the only thing there is to react to.
    emitCompanionEvent({
      kind: "reading",
      correct: results.filter(Boolean).length,
      total: results.length,
      firstRead,
    });
    if (!usingSupabase) return;

    void fetch("/api/reading-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: lesson.id,
        anonymousSessionId: getAnonymousSessionId(),
      }),
    })
      .then(() => {
        const cacheKey = `${getAnonymousSessionId()}:${lesson.id}`;
        readingProgressCache.set(cacheKey, true);
      })
      .catch(() => setDbRead(progressRead));
  };

  // Where the dialog's primary button goes: the next unread lesson of this
  // course, or back to the course when this was the last one.
  const upcoming = lesson.course_id
    ? nextLessonInCourse(state, lesson.course_id)
    : null;
  const nextLesson = upcoming && upcoming.id !== lesson.id ? upcoming : null;
  const level = state.profile ? levelProgress(state.profile.total_xp).level : 1;

  return (
    <div className="space-y-6">
      {checkResults && (
        <ReadingCompleteDialog
          results={checkResults}
          locale={locale}
          mascot={levelMascot(level)}
          mascotTitle={levelTitle(level, locale)}
          nextHref={nextLesson ? lessonHref(nextLesson) : courseHref}
          hasNext={Boolean(nextLesson)}
          onClose={() => setCheckResults(null)}
          onReview={() => {
            setCheckResults(null);
            requestAnimationFrame(() => {
              document
                .getElementById("reading-check")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          localizedHref={href}
        />
      )}
      <section className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="primary">{copy.label}</Badge>
              {lesson.level && <Badge>{lesson.level}</Badge>}
              <span
                className={[
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-black",
                  isRead
                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "border border-border bg-card text-muted",
                ].join(" ")}
              >
                {isRead && <Icon name="check" size={12} />}
                {isRead ? copy.read : copy.unread}
              </span>
              <span
                className="inline-flex h-7 items-center gap-2 rounded-full border border-border/70 bg-card/85 px-2.5 text-[11px] font-extrabold text-muted shadow-sm backdrop-blur"
                aria-label={`${lessonViewStats?.totalViews ?? 0} ${m.common.views}`}
              >
                <span className="inline-flex items-center gap-1 tabular-nums" title={m.common.views}>
                  <Icon name="eye" size={12} />
                  {(lessonViewStats?.totalViews ?? 0).toLocaleString()}
                </span>
              </span>
            </div>
            <h1 lang="ja" className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {lesson.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.intro}</p>
            {readingNote && (
              <div className="mt-3 flex max-w-3xl flex-wrap items-baseline gap-x-3 gap-y-1 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2">
                <span lang="ja" className="text-sm font-black leading-6 text-fg">
                  {readingNote.keyword}
                </span>
                <span className="text-sm font-semibold leading-6 text-muted">
                  {readingNote.body}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 text-xs font-bold text-muted">
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 tabular-nums">
              {paragraphs.filter((item) => !item.author).length} {copy.blocks}
            </span>
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 tabular-nums">
              {lesson.vocabulary?.length ?? 0}
              {m.common.words}
            </span>
          </div>
        </div>
      </section>

      <article
        id="reading-article"
        className="scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-sm)]"
      >
        <div className="relative overflow-hidden border-b border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_86%,transparent),color-mix(in_srgb,var(--card)_96%,transparent))] px-5 py-3.5 sm:px-7">
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
                <Icon name="book" size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-black leading-tight">{copy.article}</h2>
                <p className="mt-0.5 max-w-2xl text-xs font-semibold leading-5 text-muted sm:text-sm">
                  {copy.articleHint}
                </p>
              </div>
            </div>
            <span className="hidden rounded-full border border-border/70 bg-card/75 px-3 py-1.5 text-xs font-bold text-muted sm:inline-flex">
              {paragraphs.filter((item) => !item.author).length} {copy.blocks}
            </span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_18%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_24%),radial-gradient(circle_at_88%_16%,color-mix(in_srgb,var(--warning)_12%,transparent),transparent_22%),radial-gradient(circle_at_86%_84%,color-mix(in_srgb,var(--success)_9%,transparent),transparent_26%),linear-gradient(90deg,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_13%,transparent_87%,color-mix(in_srgb,var(--primary)_5%,transparent)),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_72%,transparent),color-mix(in_srgb,var(--card)_96%,transparent)_28%,color-mix(in_srgb,var(--surface)_56%,transparent))] px-4 py-7 sm:px-10 sm:py-11">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(90deg,color-mix(in_srgb,var(--fg)_4%,transparent)_1px,transparent_1px)] [background-size:48px_48px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-6 bottom-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--card)_72%,transparent),color-mix(in_srgb,var(--card)_24%,transparent)_64%,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-8 bottom-8 grid grid-cols-3 content-around justify-items-center gap-y-10 text-primary/[0.045] sm:inset-x-12 sm:grid-cols-4 sm:gap-y-14"
          >
            {Array.from({ length: 20 }).map((_, index) => (
              <span
                key={index}
                className="select-none text-[3.5rem] font-black leading-none sm:text-[5rem]"
              >
                {watermark}
              </span>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-8 top-7 select-none text-[8rem] font-black leading-none text-primary/[0.06] sm:right-12 sm:text-[11rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-10 top-24 select-none text-[4.5rem] font-black leading-none text-primary/[0.046] sm:left-20 sm:top-28 sm:text-[6rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-28 right-16 select-none text-[5.5rem] font-black leading-none text-primary/[0.048] sm:right-24 sm:text-[7rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-12 left-1/3 select-none text-[3.75rem] font-black leading-none text-primary/[0.02] sm:text-[5rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-12 select-none text-[3.25rem] font-black leading-none text-primary/[0.018] sm:text-[4.5rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-8 top-1/2 select-none text-[5rem] font-black leading-none text-primary/[0.018] sm:left-14 sm:text-[6.5rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-1/2 select-none text-[4rem] font-black leading-none text-primary/[0.02] sm:right-14 sm:text-[5.75rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[18%] bottom-1/3 select-none text-[3.75rem] font-black leading-none text-primary/[0.018] sm:text-[5.25rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[30%] bottom-1/4 select-none text-[4.25rem] font-black leading-none text-primary/[0.019] sm:text-[5.75rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[18%] top-[34%] select-none text-[3.5rem] font-black leading-none text-primary/[0.017] sm:text-[4.75rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[42%] top-[42%] select-none text-[3rem] font-black leading-none text-primary/[0.016] sm:text-[4.25rem]"
          >
            {watermark}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[58%] bottom-16 select-none text-[3.5rem] font-black leading-none text-primary/[0.018] sm:text-[4.75rem]"
          >
            {watermark}
          </div>
          <div className="relative mx-auto max-w-[50rem]">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
            />
            {paragraphs.map((paragraph, paragraphIndex) => {
              if (paragraph.author) {
                return (
                  <p
                    key={paragraph.id}
                    lang="ja"
                    className="mt-8 border-t border-border/60 pt-5 text-right text-sm font-bold leading-7 text-muted sm:text-base"
                  >
                    {paragraph.text}
                  </p>
                );
              }

              const sideLine =
                paragraphIndex % 2 === 0
                  ? "pl-5 before:left-0 sm:pl-6"
                  : "pr-5 before:right-0 sm:pr-6";

              return (
                <p
                  key={paragraph.id}
                  lang="ja"
                  className={[
                    "relative mt-7 whitespace-pre-line text-[1.08rem] font-medium leading-[2.35] text-fg first:mt-0 before:absolute before:top-3 before:h-[calc(100%-1.5rem)] before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-primary/5 before:via-primary/30 before:to-primary/5 before:content-[''] sm:text-[1.14rem] sm:leading-[2.55]",
                    sideLine,
                  ].join(" ")}
                >
                  {paragraph.text}
                </p>
              );
            })}
          </div>
        </div>
      </article>

      <LessonVocabulary vocabulary={lesson.vocabulary} lessonId={lesson.id} variant="reading" />

      {readingCheck && (
        <ReadingCheck
          questions={readingCheck}
          onSubmitComplete={markRead}
        />
      )}

      <div className="flex justify-end">
        <Link href={href(courseHref)} className={buttonClasses("secondary")}>
          <Icon name="arrow-left" size={16} />
          {copy.back}
        </Link>
      </div>

      {isAdmin(state) && (
        <div className="flex justify-end">
          <Link href={href(`${lessonHref(lesson)}/edit`)} className={buttonClasses("ghost")}>
            {m.common.edit}
          </Link>
        </div>
      )}
    </div>
  );
}

function MissionCompleteDialog({
  outcome,
  onClose,
  t,
  dayLabel,
}: {
  outcome: AttemptOutcome;
  onClose: () => void;
  t: Dictionary["player"];
  dayLabel: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-complete-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-[var(--success)]/25 bg-card p-5 text-center shadow-[var(--shadow-lg)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
          <Icon name="flame" size={34} filled />
        </div>
        <p
          id="mission-complete-title"
          className="mt-4 text-2xl font-extrabold text-fg"
        >
          {t.missionDialogTitle}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">{t.missionDialogBody}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs font-bold text-muted">Streak</p>
            <p className="mt-0.5 text-lg font-extrabold text-[var(--success)]">
              {outcome.currentStreak}
              {dayLabel}
            </p>
          </div>
          <div className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs font-bold text-muted">{t.bonus}</p>
            <p className="mt-0.5 text-lg font-extrabold text-primary">+100 XP</p>
          </div>
        </div>
        {outcome.leveledUp && (
          <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
            {t.levelUp(outcome.newLevel)}
          </p>
        )}
        <Button onClick={onClose} className="mt-5 w-full">
          {t.continueButton}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

const TRANSCRIPT_TOKEN_STYLE: Record<ScoreAlignmentToken["status"], string> = {
  match: "bg-[var(--success-soft)] text-[var(--success)]",
  substitution: "bg-[var(--warning-soft)] text-[var(--warning)]",
  missing: "bg-[var(--danger-soft)] text-[var(--danger)] line-through",
  extra: "bg-primary/10 text-primary",
};

function TranscriptComparison({
  transcript,
  textAlignment,
  t,
}: {
  transcript: string;
  textAlignment?: ScoreAlignmentToken[];
  t: Dictionary["player"];
}) {
  const hasTranscript = transcript.trim().length > 0;
  const displayAlignment = textAlignment?.length ? textAlignment : undefined;

  return (
    <div className="mx-auto mt-3 max-w-2xl text-left">
      <p className="text-xs font-extrabold text-muted">{t.recognized}</p>
      <p
        lang="ja"
        className="mt-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold leading-8 text-fg"
      >
        {!hasTranscript
          ? t.notRecognized
          : displayAlignment?.length
            ? displayAlignment.map((token, i) => (
                <TranscriptToken token={token} key={`${i}-${token.status}`} t={t} />
              ))
            : transcript}
      </p>
    </div>
  );
}

function TranscriptToken({
  token,
  t,
}: {
  token: ScoreAlignmentToken;
  t: Dictionary["player"];
}) {
  const visibleText = token.status === "missing" ? token.target : token.spoken;
  if (!visibleText) return null;

  return (
    <span
      className={[
        "mr-1 inline rounded-md px-1 py-0.5",
        TRANSCRIPT_TOKEN_STYLE[token.status],
      ].join(" ")}
      title={
        token.status === "substitution" && token.target
          ? t.tokenCorrect(token.target)
          : token.status === "missing"
            ? t.tokenMissing
            : token.status === "extra"
              ? t.tokenExtra
              : t.tokenMatch
      }
    >
      {visibleText}
    </span>
  );
}

function DialogueScript({
  sentences,
  activeIndex,
  mediaUrl,
  sourceUrl,
  audioRef,
  passedForSentence,
  onPractice,
  onTimeUpdate,
  onStop,
  t,
}: {
  sentences: LessonSentence[];
  activeIndex: number;
  mediaUrl: string | null;
  sourceUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  passedForSentence: (id: string) => boolean;
  onPractice: (index: number) => void;
  onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onStop: () => void;
  t: Dictionary["player"];
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-md)]">
      <div className="brand-gradient relative overflow-hidden px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-white/20" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/75">
            Step 1
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">{t.step1Title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/82">
            {t.step1Body}
          </p>
        </div>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {mediaUrl && (
          <div className="mb-3 rounded-xl border border-border bg-surface/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Icon name="volume" size={16} />
              {t.lessonAudio}
            </div>
            <audio
              ref={audioRef}
              src={mediaUrl}
              controls
              className="h-10 w-full"
              onTimeUpdate={onTimeUpdate}
              onPause={onStop}
              onEnded={onStop}
            />
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline"
              >
                {t.openDrive}
              </a>
            )}
          </div>
        )}

        {sentences.map((sentence, i) => {
          const active = i === activeIndex;
          const passed = passedForSentence(sentence.id);
          return (
            <article
              key={sentence.id}
              className={[
                "group relative flex items-start gap-3 transition-colors",
                active ? "" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onPractice(i)}
                className={[
                  "focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold tabular-nums transition-all",
                  active
                    ? "bg-primary text-white shadow-[var(--shadow-glow)]"
                    : passed
                      ? "bg-[var(--success)] text-white"
                      : "border border-border bg-surface text-muted group-hover:border-primary/40 group-hover:text-primary",
                ].join(" ")}
                aria-label={t.practiceSentence(i + 1)}
              >
                {passed ? "✓" : i + 1}
              </button>

              <div
                className={[
                  "min-w-0 flex-1 rounded-xl border px-3 py-2.5 transition-colors",
                  active
                    ? "border-primary/30 bg-primary/7"
                    : "border-border bg-surface/70 group-hover:bg-card",
                ].join(" ")}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-muted">
                    {t.utterance(i + 1)}
                  </span>
                  {active && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                      {t.practicing}
                    </span>
                  )}
                  {passed && !active && (
                      <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--success)]">
                      {t.passedTag}
                    </span>
                  )}
                </div>

                <p lang="ja" className="text-[0.93rem] font-semibold leading-[2] text-fg [&_rt]:text-[0.55em] [&_rt]:font-medium [&_rt]:text-muted">
                  <Furigana sentence={sentence} />
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SentenceNumberNav({
  sentences,
  activeIndex,
  bestScoreForSentence,
  passedForSentence,
  onSelect,
  t,
  pointsLabel,
}: {
  sentences: LessonSentence[];
  activeIndex: number;
  bestScoreForSentence: (id: string) => number | null;
  passedForSentence: (id: string) => boolean;
  onSelect: (index: number) => void;
  t: Dictionary["player"];
  pointsLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-bold text-muted">{t.sentenceShort}</span>
        {sentences.map((sentence, i) => {
          const active = i === activeIndex;
          const passed = passedForSentence(sentence.id);
          const bestScore = bestScoreForSentence(sentence.id);
          return (
            <button
              key={sentence.id}
              type="button"
              onClick={() => onSelect(i)}
              title={
                bestScore != null
                  ? `${i + 1}: ${bestScore}${pointsLabel}`
                  : `${i + 1}`
              }
              className={[
                "focus-ring grid h-9 min-w-9 place-items-center rounded-lg px-2 text-xs font-extrabold tabular-nums transition-all active:scale-95",
                active
                  ? "bg-primary text-white shadow-sm"
                  : passed
                    ? "bg-[var(--success)] text-white"
                    : "border border-border bg-card text-muted hover:border-primary/40 hover:text-primary",
              ].join(" ")}
              aria-label={t.sentenceNumber(i + 1)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InlineScore({
  score,
  improvement,
  t,
}: {
  score: ScoreBreakdown;
  improvement: number | null;
  t: Dictionary["player"];
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={[
              "grid h-10 w-10 place-items-center rounded-xl text-sm font-extrabold text-white tabular-nums",
              score.passed ? "bg-[var(--success)]" : "bg-[var(--warning)]",
            ].join(" ")}
          >
            {score.total}
          </span>
          <div>
            <p className="text-sm font-extrabold">
              {score.passed ? t.pass : t.almost}
            </p>
            {typeof improvement === "number" && improvement > 0 && (
              <p className="text-xs font-semibold text-[var(--success)]">
                {t.improvement(improvement)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 text-[11px] font-bold tabular-nums text-muted">
          <span>
            {t.dimPronunciation} {score.pronunciation}
          </span>
          <span>
            {t.dimCoverage} {score.coverage ?? "—"}
          </span>
          <span>
            {t.dimSpeed} {score.speed}
          </span>
          <span>
            {t.dimIntonation} {score.intonation ?? "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const { state, recordAttempt, ensureLessonSentences, usingSupabase } = useData();
  const searchParams = useSearchParams();
  const { locale, dictionary: m, href } = useI18n();
  const t = m.player;
  const [index, setIndex] = useState(0);
  const [fresh, setFresh] = useState<FreshResult | null>(null);
  const [missionAlert, setMissionAlert] = useState<AttemptOutcome | null>(null);
  const [scoring, setScoring] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const [lessonViewStats, setLessonViewStats] = useState<LessonViewStats | null>(null);
  const lessonAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const inlineScoreRef = useRef<HTMLDivElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const canRecord = Boolean(state.profile);
  // Feature-detect on the client only (default true to avoid an SSR flash).
  const [sttSupported, setSttSupported] = useState(true);
  useEffect(() => setSttSupported(isSpeechRecognitionSupported()), []);

  const lesson = lessonById(state, lessonId);
  const sentences = useMemo(
    () => sentencesForLesson(state, lessonId),
    [state, lessonId],
  );

  useEffect(() => {
    if (!lesson || sentences.length > 0 || !usingSupabase) return;
    void ensureLessonSentences(lesson.id);
  }, [ensureLessonSentences, lesson, sentences.length, usingSupabase]);

  const lessonIdForView = lesson?.id;

  useEffect(() => {
    if (!lessonIdForView || !usingSupabase) return;

    const now = Date.now();
    const lastRecordedAt = recentLessonViewRecords.get(lessonIdForView) ?? 0;
    if (now - lastRecordedAt < LESSON_VIEW_DEDUPE_MS) return;
    recentLessonViewRecords.set(lessonIdForView, now);

    const timeout = window.setTimeout(() => {
      void fetch("/api/lesson-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lessonIdForView,
          anonymousSessionId: getAnonymousSessionId(),
        }),
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [lessonIdForView, usingSupabase]);

  useEffect(() => {
    if (!lesson || !usingSupabase) {
      setLessonViewStats(null);
      return;
    }

    let cancelled = false;
    const cached = lessonViewStatsCache.get(lesson.id);
    if (cached) {
      setLessonViewStats(cached);
      return;
    }

    const timeout = window.setTimeout(() => {
      const pending =
        lessonViewStatsPending.get(lesson.id) ??
        fetch(`/api/lesson-views?lessonId=${encodeURIComponent(lesson.id)}`, {
          cache: "no-store",
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (!payload?.lesson) return null;
            return {
              totalViews: payload.lesson.totalViews ?? 0,
              shadowingUsers: payload.lesson.shadowingUsers ?? 0,
            };
          })
          .finally(() => lessonViewStatsPending.delete(lesson.id));

      lessonViewStatsPending.set(lesson.id, pending);
      pending
        .then((stats) => {
          if (!stats) return;
          lessonViewStatsCache.set(lesson.id, stats);
          if (!cancelled) setLessonViewStats(stats);
        })
        .catch(() => {
          if (!cancelled) setLessonViewStats(null);
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [lesson, usingSupabase]);

  if (lesson && sentences.length === 0 && usingSupabase) {
    return (
      <div className="card p-6 text-center text-muted">
        <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-sm font-semibold">{t.loading}</p>
      </div>
    );
  }

  if (!lesson || sentences.length === 0) {
    return (
      <div className="card p-6 text-center text-muted">
        {t.notFound}{" "}
        <Link href={href("/courses")} className="text-primary underline">
          {t.backToList}
        </Link>
      </div>
    );
  }

  const mediaUrl = lesson.media_url;
  const parentCourse = lesson.course_id
    ? courseById(state, lesson.course_id)
    : undefined;
  const baseCourseHref = parentCourse
    ? courseHrefOf(parentCourse)
    : `/courses/${lesson.course_id ?? UNCATEGORIZED_COURSE_ID}`;
  const fromMondai = searchParams.get("fromMondai");
  const fromExam = searchParams.get("fromExam");
  const courseHref =
    isN2Course(parentCourse) && fromMondai && fromExam
      ? `${baseCourseHref}?mondai=${encodeURIComponent(fromMondai)}&exam=${encodeURIComponent(fromExam)}#n2-filter`
      : baseCourseHref;

  if (lesson.topic === "読解" || parentCourse?.topic === "読解") {
    return (
      <ReadingLesson
        lesson={lesson}
        sentences={sentences}
        courseHref={courseHref}
        lessonViewStats={lessonViewStats}
      />
    );
  }

  const current = sentences[Math.min(index, sentences.length - 1)];
  const passed = passedCountForLesson(state, lessonId);
  const total = sentences.length;
  const lessonDone = passed >= total;

  const attempts = myAttemptsForSentence(state, current.id);
  const latest = attempts.length ? attempts[attempts.length - 1] : null;
  const currentPassed = isSentencePassed(state, current.id);

  const displayScore = fresh?.score ?? (latest ? attemptToScore(latest) : null);
  const improvement =
    fresh && fresh.outcome.previousBestTotal != null
      ? fresh.score.total - fresh.outcome.previousBestTotal
      : null;

  function goTo(i: number, scrollToPractice = false) {
    cancelSpeech();
    setIndex(i);
    setFresh(null);
    setRecorderKey((k) => k + 1);
    if (scrollToPractice) {
      requestAnimationFrame(() => {
        document
          .getElementById("shadowing-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function handleListen(rate = 1) {
    if (current.audio_url) {
      const audio = sentenceAudioRef.current ?? new Audio();
      sentenceAudioRef.current = audio;
      audio.pause();
      audio.src = current.audio_url;
      audio.currentTime = 0;
      audio.playbackRate = rate;
      await audio.play();
      return;
    }

    if (mediaUrl && lessonAudioRef.current) {
      const audio = lessonAudioRef.current;
      const start = current.audio_start ?? 0;
      const end = current.audio_end;
      audio.pause();
      audio.currentTime = start;
      stopAtRef.current = end;
      audio.playbackRate = rate;
      await audio.play();
      return;
    }
    await speakJa(current.ja_text, rate);
  }

  function handleLessonAudioTimeUpdate(e: React.SyntheticEvent<HTMLAudioElement>) {
    const stopAt = stopAtRef.current;
    if (stopAt == null) return;
    const audio = e.currentTarget;
    if (audio.currentTime >= stopAt) {
      audio.pause();
      stopAtRef.current = null;
    }
  }

  async function measureIntonation(
    userAudioUrl: string | null,
  ): Promise<number | null> {
    if (!userAudioUrl) return null;
    try {
      const userContour = await extractContourFromUrl(userAudioUrl);
      if (userContour.length === 0) return null;

      let refContour: number[] = [];
      if (current.audio_url) {
        refContour = await extractContourFromUrl(current.audio_url);
      } else if (
        mediaUrl &&
        current.audio_start != null &&
        current.audio_end != null
      ) {
        refContour = await extractContourFromUrl(mediaUrl, {
          start: current.audio_start,
          end: current.audio_end,
        });
      }
      if (refContour.length === 0) return null;

      return contourMetrics(userContour, refContour)?.score ?? null;
    } catch {
      return null;
    }
  }

  async function handleResult(r: RecordResult) {
    if (!canRecord) return;

    setScoring(true);
    try {
      const originalDuration =
        current.audio_start != null && current.audio_end != null
          ? current.audio_end - current.audio_start
          : estimateDurationSeconds(current.ja_text);

      // Intonation: compare the pitch-contour shape of the recording against the
      // reference audio. Only possible when a reference exists (per-sentence
      // audio, or a timed slice of the lesson media) — TTS-only lessons have no
      // reference, so intonation stays unmeasured (null) rather than faked.
      const intonationSimilarity = await measureIntonation(r.audioUrl);

      const score = await scoreSentence({
        targetText: current.ja_text,
        spokenText: r.transcript || null,
        originalDurationSeconds: originalDuration,
        userDurationSeconds: r.durationSeconds,
        intonationSimilarity,
        passScore: current.pass_score,
        locale,
      });

      const outcome = recordAttempt({
        sentenceId: current.id,
        score,
        recordingUrl: r.audioUrl,
        transcript: r.transcript || null,
        userDurationSeconds: r.durationSeconds,
      });

      setFresh({ score, outcome, audioUrl: r.audioUrl, transcript: r.transcript });
      // Tell the companion what just happened so it can cheer or reassure. It
      // decides what is worth saying; the player only reports the facts.
      emitCompanionEvent({
        kind: "attempt",
        passed: score.passed,
        total: score.total,
        passScore: current.pass_score,
        improvedBy:
          outcome.previousBestTotal != null
            ? score.total - outcome.previousBestTotal
            : null,
        firstPassToday: outcome.countedToday,
        tries: attempts.length + 1,
        lessonCompleted: outcome.lessonCompletedNow,
        missionCompleted: outcome.missionCompletedNow,
        streakIncreased: outcome.streakIncreased,
        currentStreak: outcome.currentStreak,
        leveledUp: outcome.leveledUp,
        newLevel: outcome.newLevel,
      });
      if (outcome.missionCompletedNow) {
        setMissionAlert(outcome);
      }
      requestAnimationFrame(() => {
        inlineScoreRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } finally {
      setScoring(false);
    }
  }

  const celebrations = buildCelebrations(t, fresh?.outcome);
  const hasNext = index < total - 1;
  const progressPct = (passed / total) * 100;

  return (
    <div className="space-y-6">
      {missionAlert && (
        <MissionCompleteDialog
          outcome={missionAlert}
          onClose={() => setMissionAlert(null)}
          t={t}
          dayLabel={m.common.days}
        />
      )}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card p-5 shadow-[var(--shadow-md)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {lesson.topic && <Badge tone="primary">{lesson.topic}</Badge>}
              {lesson.level && <Badge>{lesson.level}</Badge>}
              <Badge tone={lessonDone ? "success" : "warning"}>
                {lessonDone ? t.statusDone : t.statusLearning}
              </Badge>
              <span
                className="inline-flex h-7 items-center gap-2 rounded-full border border-border/70 bg-card/85 px-2.5 text-[11px] font-extrabold text-muted shadow-sm backdrop-blur"
                aria-label={`${lessonViewStats?.totalViews ?? 0} ${m.common.views}, ${
                  lessonViewStats?.shadowingUsers ?? 0
                } ${m.common.shadowingUsers}`}
              >
                <span
                  className="inline-flex items-center gap-1 tabular-nums"
                  title={m.common.views}
                >
                  <Icon name="eye" size={12} />
                  {(lessonViewStats?.totalViews ?? 0).toLocaleString()}
                </span>
                <span className="h-3 w-px bg-border" aria-hidden="true" />
                <span
                  className="inline-flex items-center gap-1 tabular-nums"
                  title={m.common.shadowingUsers}
                >
                  <Icon name="users" size={12} />
                  {(lessonViewStats?.shadowingUsers ?? 0).toLocaleString()}
                </span>
              </span>
            </div>
            <h1 lang="ja" className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {lesson.title}
            </h1>
            <p className="mt-2 text-sm text-muted">{t.intro}</p>
            <button
              type="button"
              onClick={() => goTo(index, true)}
              className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all hover:brightness-110 active:scale-[0.97]"
            >
              {t.goShadowing}
              <Icon name="arrow-right" size={16} />
            </button>
            {isAdmin(state) && (
              <Link
                href={href(`${lessonHref(lesson)}/edit`)}
                className={`${buttonClasses("ghost")} mt-4 ml-2`}
              >
                {m.common.edit}
              </Link>
            )}
          </div>

          <div className="w-full rounded-3xl border border-border bg-surface/80 p-4 lg:w-80">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">{t.progress}</span>
              <span className="font-bold tabular-nums text-primary">
                {t.sentencesOf(passed, total)}
              </span>
            </div>
            <ProgressBar value={progressPct} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-card px-2 py-2">
                <p className="font-bold text-fg">{total}</p>
                <p className="text-muted">{t.statAll}</p>
              </div>
              <div className="rounded-2xl bg-card px-2 py-2">
                <p className="font-bold text-[var(--success)]">{passed}</p>
                <p className="text-muted">{t.statPass}</p>
              </div>
              <div className="rounded-2xl bg-card px-2 py-2">
                <p className="font-bold text-primary">{index + 1}</p>
                <p className="text-muted">{t.statCurrent}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <DialogueScript
          sentences={sentences}
          activeIndex={index}
          mediaUrl={mediaUrl}
          sourceUrl={lesson.source_url}
          audioRef={lessonAudioRef}
          passedForSentence={(id) => isSentencePassed(state, id)}
          onPractice={(i) => goTo(i, true)}
          onTimeUpdate={handleLessonAudioTimeUpdate}
          onStop={() => {
            stopAtRef.current = null;
          }}
          t={t}
        />

        <section id="shadowing-panel" className="min-w-0 scroll-mt-24 space-y-4">
          <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-md)]">
            <div className="border-b border-border bg-surface/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                    Step 2
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold">Shadowing</h2>
                  <p className="mt-1 text-sm text-muted">{t.step2Body}</p>
                </div>
                <Badge tone={currentPassed ? "success" : "primary"}>
                  {index + 1}/{total}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <SentenceNumberNav
                sentences={sentences}
                activeIndex={index}
                bestScoreForSentence={(id) =>
                  bestAttemptForSentence(state, id)?.total_score ?? null
                }
                passedForSentence={(id) => isSentencePassed(state, id)}
                onSelect={goTo}
                t={t}
                pointsLabel={m.common.points}
              />

              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-surface text-center">
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px brand-gradient" />
                <div className="px-4 py-3.5">
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      currentPassed
                        ? "bg-[var(--success-soft)] text-[var(--success)]"
                        : "bg-primary/10 text-primary",
                    ].join(" ")}
                  >
                    <Icon name={currentPassed ? "check" : "mic"} size={14} />
                    {currentPassed ? t.passedTag : t.speakThis}
                  </span>
                  <p lang="ja" className="mx-auto mt-2.5 max-w-2xl text-[0.92rem] font-bold leading-[2.1] sm:text-base sm:leading-[2.2] [&_rt]:text-[0.55em] [&_rt]:font-medium [&_rt]:text-muted">
                    <Furigana sentence={current} />
                  </p>
                  {current.vi_translation && (
                    <p className="mx-auto mt-1.5 max-w-xl rounded-lg bg-card px-2.5 py-1.5 text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">
                      {current.vi_translation}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(index - 1)}
                      disabled={index === 0}
                      aria-label={t.prevSentence}
                      className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted transition-colors enabled:hover:border-primary/40 enabled:hover:text-primary disabled:opacity-40"
                    >
                      <Icon name="arrow-left" size={18} />
                    </button>
                    <Button
                      variant="secondary"
                      onClick={() => handleListen(1)}
                      className="min-w-[8.5rem]"
                    >
                      <Icon name="volume" size={18} />
                      {mediaUrl ? t.listenSentence : t.listenTts}
                    </Button>
                    {canRecord ? (
                      <AudioRecorder
                        inline
                        hideNotes
                        disabled={scoring}
                        onResult={handleResult}
                        key={recorderKey}
                        className="min-w-[8.5rem]"
                      />
                    ) : (
                      <Link
                        href={href("/login")}
                        className={buttonClasses("primary", "md", "min-w-[8.5rem]")}
                      >
                        <Icon name="mic" size={18} />
                        {t.loginToRecord}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => goTo(index + 1)}
                      disabled={!hasNext}
                      aria-label={t.nextSentence}
                      className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted transition-colors enabled:hover:border-primary/40 enabled:hover:text-primary disabled:opacity-40"
                    >
                      <Icon name="arrow-right" size={18} />
                    </button>
                    <span className="basis-full text-center text-[11px] font-bold text-muted">
                      {t.scoreTargetHint(current.pass_score)}
                    </span>
                    {!sttSupported && (
                      <p className="basis-full text-center text-[11px] text-[var(--warning)]">
                        {t.sttUnsupported}
                      </p>
                    )}
                  </div>
                </div>

                {(scoring || fresh?.audioUrl || displayScore) && (
                  <div className="border-t border-border bg-card/55 px-4 py-3 text-left">
                    {scoring && (
                      <p className="text-center text-xs text-muted">{t.scoring}</p>
                    )}
                    {fresh?.audioUrl && (
                      <div className="mx-auto mt-2.5 max-w-md">
                        <p className="mb-1 text-xs text-muted">{t.replayRecording}</p>
                        <audio src={fresh.audioUrl} controls className="h-10 w-full" />
                      </div>
                    )}
                    {fresh && (
                      <TranscriptComparison
                        transcript={fresh.transcript}
                        textAlignment={fresh.score.textAlignment}
                        t={t}
                      />
                    )}
                    {displayScore && (
                      <div ref={inlineScoreRef}>
                        <InlineScore score={displayScore} improvement={improvement} t={t} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {celebrations.map((c, i) => (
            <div
              key={i}
              className="animate-pop flex items-center gap-2 rounded-xl border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-sm font-medium text-[var(--success)]"
            >
              <Icon name={c.icon} size={18} filled={c.icon !== "check"} />
              {c.text}
            </div>
          ))}

          {displayScore && (
            <div className="animate-in">
              <ScoreResult
                score={displayScore}
                passScore={current.pass_score}
                improvement={improvement}
              />
            </div>
          )}

          {lessonDone && <LessonReview lessonId={lessonId} />}

          {lessonDone && (
            <div className="flex justify-end">
              <Link href={href(courseHref)} className={buttonClasses("primary")}>
                <Icon name="trophy" size={16} />
                {t.finishBackToList}
              </Link>
            </div>
          )}
        </section>
      </div>

      <LessonVocabulary vocabulary={lesson.vocabulary} lessonId={lesson.id} />
    </div>
  );
}

interface Celebration {
  icon: IconName;
  text: string;
}

function buildCelebrations(
  t: Dictionary["player"],
  outcome?: AttemptOutcome,
): Celebration[] {
  if (!outcome) return [];
  const out: Celebration[] = [];
  if (outcome.missionCompletedNow)
    out.push({ icon: "flame", text: t.celebrateMission });
  if (outcome.leveledUp)
    out.push({ icon: "sparkles", text: t.levelUp(outcome.newLevel) });
  if (outcome.lessonCompletedNow)
    out.push({ icon: "trophy", text: t.celebrateLesson });
  if (
    !outcome.missionCompletedNow &&
    !outcome.leveledUp &&
    !outcome.lessonCompletedNow &&
    outcome.countedToday &&
    outcome.xpGained > 0
  )
    out.push({ icon: "star", text: `+${outcome.xpGained} XP` });
  return out;
}

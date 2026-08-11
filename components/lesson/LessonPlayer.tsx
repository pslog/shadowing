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
  UNCATEGORIZED_COURSE_ID,
} from "@/lib/store/selectors";
import type { AttemptOutcome } from "@/lib/store/engine";
import { scoreSentence, estimateDurationSeconds } from "@/lib/client/score";
import { extractContourFromUrl, contourMetrics } from "@/lib/speech/pitch";
import { speakJa, cancelSpeech } from "@/lib/speech/tts";
import { isSpeechRecognitionSupported, type RecordResult } from "@/lib/speech/useRecorder";
import type {
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
import type { Dictionary } from "@/lib/i18n";

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

const LESSON_VIEW_DEDUPE_MS = 2_000;
const recentLessonViewRecords = new Map<string, number>();

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

    void fetch("/api/lesson-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lessonIdForView }),
    });
  }, [lessonIdForView, usingSupabase]);

  useEffect(() => {
    if (!lesson || !usingSupabase) {
      setLessonViewStats(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/lesson-views?lessonId=${encodeURIComponent(lesson.id)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.lesson) return;
        setLessonViewStats({
          totalViews: payload.lesson.totalViews ?? 0,
          shadowingUsers: payload.lesson.shadowingUsers ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) setLessonViewStats(null);
      });

    return () => {
      cancelled = true;
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

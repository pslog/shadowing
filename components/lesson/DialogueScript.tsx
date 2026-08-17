"use client";

import { Icon } from "@/components/ui/icon";
import { Furigana } from "./Furigana";
import type { LessonSentence } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

/**
 * Step 1 of a shadowing lesson: the script, line by line, with furigana.
 *
 * `preview` renders the same panel for a signed-out visitor — same header, same
 * line cards — minus the audio and the practice buttons, faded out partway.
 * Sharing the component is what keeps the teaser looking like the real lesson
 * instead of an imitation that drifts out of sync with it.
 */
export function DialogueScript({
  sentences,
  activeIndex = -1,
  mediaUrl = null,
  sourceUrl = null,
  audioRef,
  passedForSentence = () => false,
  onPractice,
  onTimeUpdate,
  onStop,
  preview = false,
  t,
}: {
  sentences: LessonSentence[];
  activeIndex?: number;
  mediaUrl?: string | null;
  sourceUrl?: string | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  passedForSentence?: (id: string) => boolean;
  onPractice?: (index: number) => void;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onStop?: () => void;
  /** Signed-out teaser: no audio, no practice buttons, fades out at the end. */
  preview?: boolean;
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

      <div
        className={[
          "space-y-2 p-3 sm:p-4",
          preview
            ? "max-h-[26rem] overflow-hidden [mask-image:linear-gradient(180deg,#000_72%,transparent_99%)] sm:max-h-[32rem]"
            : "",
        ].join(" ")}
      >
        {mediaUrl && !preview && (
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
              {preview ? (
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-xs font-extrabold tabular-nums text-muted"
                  aria-hidden
                >
                  {i + 1}
                </span>
              ) : (
              <button
                type="button"
                onClick={() => onPractice?.(i)}
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
              )}

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

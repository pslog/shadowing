"use client";

import type { LessonSentence } from "@/lib/types";
import { Furigana } from "./Furigana";

/** One rendered block of the passage: Japanese, its translation, author line. */
export interface ReadingParagraph {
  id: string;
  text: string;
  translation: string | null;
  author: boolean;
  sentence?: LessonSentence;
}

/**
 * The 読解 passage exactly as it is meant to look: gradient masthead, paper
 * texture, kanji watermarks, Japanese and Vietnamese side by side.
 *
 * It lives here rather than inside the player because the signed-out wall shows
 * the SAME article, just trimmed and faded. Copying the markup would mean the
 * teaser drifting away from the real thing every time one of them is styled.
 */
export function ReadingArticle({
  label,
  heading,
  note,
  watermark,
  paragraphs,
  chips,
  fade = false,
  missingTranslationText,
}: {
  /** Small eyebrow above the title (course/series name). */
  label: string;
  heading: string;
  note: { keyword: string; body: string } | null;
  watermark: string;
  paragraphs: ReadingParagraph[];
  /** Status/stat pills under the title — different for a guest than a reader. */
  chips?: React.ReactNode;
  /** Cut the passage off under a gradient mask (the signed-out preview). */
  fade?: boolean;
  missingTranslationText: string;
}) {
  return (
  <article
    id="reading-article"
    className="scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-sm)]"
  >
    <div className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_10%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_28%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_90%,transparent),color-mix(in_srgb,var(--card)_98%,transparent))] px-5 py-4 sm:px-7 sm:py-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-7 select-none text-[8rem] font-black leading-none text-primary/[0.045] sm:right-4 sm:text-[10rem]"
      >
        {watermark}
      </div>
      <div className="relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="text-sm font-extrabold text-primary/75">{label}</p>
          <h1 lang="ja" className="mt-1 text-[2.45rem] font-black leading-none text-fg sm:text-[3.35rem]">
            {heading}
          </h1>
          {note && (
            <div className="mt-3 max-w-3xl">
              <p
                lang="ja"
                className="inline-flex items-center justify-center rounded-full bg-primary/8 px-3 py-1 text-sm font-black leading-6 text-primary"
              >
                {note.keyword}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-muted sm:text-[0.95rem]">
                {note.body}
              </p>
            </div>
          )}

          {chips}
        </div>
      </div>
    </div>
    <div
      className={[
        "relative overflow-hidden bg-[radial-gradient(circle_at_12%_18%,color-mix(in_srgb,var(--primary)_4%,transparent),transparent_24%),radial-gradient(circle_at_88%_16%,color-mix(in_srgb,var(--warning)_5%,transparent),transparent_22%),linear-gradient(90deg,color-mix(in_srgb,var(--fg)_2.5%,transparent),transparent_16%,transparent_84%,color-mix(in_srgb,var(--fg)_2.5%,transparent)),linear-gradient(180deg,#f6f4ee,#fbfaf6_28%,#f2efe7)] px-4 py-5 sm:px-9 sm:py-8",
        // Preview: the text runs out under a mask instead of an ellipsis,
        // so the page reads as "there is more", not "there is nothing".
        fade
          ? "max-h-[26rem] [mask-image:linear-gradient(180deg,#000_70%,transparent_99%)] sm:max-h-[32rem]"
          : "",
      ].join(" ")}
    >
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
      <div className="relative mx-auto max-w-6xl bg-[linear-gradient(90deg,rgba(255,254,249,0.44)_0%,rgba(244,241,232,0.32)_49.5%,rgba(168,156,132,0.14)_50%,rgba(244,241,232,0.32)_50.5%,rgba(255,254,249,0.44)_100%)] px-3 py-4 sm:px-6 sm:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-3 left-1/2 hidden w-10 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(82,70,48,0.09),rgba(82,70,48,0.028)_38%,transparent_72%)] lg:block"
        />
        <div className="relative space-y-2.5">
            {paragraphs.map((paragraph, paragraphIndex) => {
              const missingTranslation = !paragraph.translation;
              const softOffset = paragraphIndex % 2 === 0 ? "" : "lg:translate-x-0.5";

              return (
                <div
                  key={paragraph.id}
                  className={[
                    "grid gap-1 rounded-xl px-0 py-0.5 transition-colors lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8",
                    softOffset,
                    paragraph.author ? "items-end" : "items-start",
                  ].join(" ")}
                >
                  <div>
                    <p
                      lang="ja"
                      className={[
                        "whitespace-pre-line text-fg [&_rt]:text-[0.5em] [&_rt]:font-semibold [&_rt]:leading-none [&_rt]:text-muted/75",
                        paragraph.author
                          ? "text-right text-sm font-bold leading-8 text-muted sm:text-base"
                          : "text-[1.02rem] font-medium leading-[2.05] sm:text-[1.08rem] sm:leading-[2.15]",
                      ].join(" ")}
                    >
                      {paragraph.sentence ? <Furigana sentence={paragraph.sentence} /> : paragraph.text}
                    </p>
                  </div>
                  <div className="pl-3 lg:pl-0">
                    <p
                      className={[
                        paragraph.author
                          ? "text-right text-sm font-normal leading-7 text-muted sm:text-base"
                          : "text-[0.98rem] font-normal leading-7 text-muted sm:text-[1.02rem] sm:leading-8",
                        missingTranslation ? "text-muted/70" : "",
                      ].join(" ")}
                    >
                      {paragraph.translation ?? missingTranslationText}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  </article>
  );
}

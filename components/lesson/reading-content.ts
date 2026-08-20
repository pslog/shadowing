// Shaping a 読解 lesson's raw sentences into what the page renders.
//
// Its own module because both the lesson player and the signed-out wall build
// the same paragraphs — importing one component from the other would make the
// two files circular.

import type { Lesson, LessonSentence } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import type { ReadingParagraph } from "./ReadingArticle";

export function readingWatermark(lesson: Lesson) {
  return lesson.reading_meta?.watermark ?? lesson.title.trim().charAt(0) ?? "読";
}

export function readingMemo(lesson: Lesson, locale: Locale) {
  return lesson.reading_meta?.memo?.[locale] ?? lesson.reading_meta?.memo?.ja ?? null;
}

export function buildReadingParagraphs(lesson: Lesson, sentences: LessonSentence[]) {
  void lesson;
  return sentences.map((sentence): ReadingParagraph => ({
    id: sentence.id,
    text: sentence.ja_text,
    translation: sentence.vi_translation?.trim() || null,
    author: sentence.ja_text.startsWith("☞") || sentence.ja_text.startsWith("―"),
    sentence,
  }));
}

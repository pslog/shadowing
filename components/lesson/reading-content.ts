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

function joinReadingTranslation(items: LessonSentence[]) {
  const text = items
    .map((item) => item.vi_translation?.trim())
    .filter(Boolean)
    .join(" ");
  return text.length > 0 ? text : null;
}

export function buildReadingParagraphs(lesson: Lesson, sentences: LessonSentence[]) {
  const source = sentences.map((sentence) => sentence.ja_text);
  const makeParagraph = (start: number, end: number): ReadingParagraph => ({
    id: sentences[start]?.id ?? String(start),
    text: source.slice(start, end).join(""),
    translation: joinReadingTranslation(sentences.slice(start, end)),
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
        translation: sentences[16].vi_translation,
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
        translation: joinReadingTranslation(sentences.slice(3, 12)),
        author: false,
      },
      makeParagraph(12, 20),
      {
        id: sentences[20].id,
        text: [source[20], source[21], ...source.slice(22, 26)].join("\n"),
        translation: joinReadingTranslation(sentences.slice(20, 26)),
        author: false,
      },
      {
        id: sentences[26].id,
        text: sentences[26].ja_text,
        translation: sentences[26].vi_translation,
        author: true,
      },
    ];
  }

  const paragraphs: ReadingParagraph[] = [];
  let buffer: LessonSentence[] = [];

  for (const sentence of sentences) {
    if (sentence.ja_text.startsWith("☞") || sentence.ja_text.startsWith("―")) {
      if (buffer.length > 0) {
        paragraphs.push({
          id: buffer[0].id,
          text: buffer.map((item) => item.ja_text).join(""),
          translation: joinReadingTranslation(buffer),
          author: false,
        });
        buffer = [];
      }
      paragraphs.push({
        id: sentence.id,
        text: sentence.ja_text,
        translation: sentence.vi_translation,
        author: true,
      });
      continue;
    }

    buffer.push(sentence);
    if (buffer.length >= 4) {
      paragraphs.push({
        id: buffer[0].id,
        text: buffer.map((item) => item.ja_text).join(""),
        translation: joinReadingTranslation(buffer),
        author: false,
      });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    paragraphs.push({
      id: buffer[0].id,
      text: buffer.map((item) => item.ja_text).join(""),
      translation: joinReadingTranslation(buffer),
      author: false,
    });
  }

  return paragraphs;
}

import type { Course, Lesson } from "@/lib/types";

export const N2_COURSE_ID = "00000000-0000-0000-0000-0000000c000f";
export const N2_COURSE_SLUG = "jlpt-n2-choukai";
export const LEGACY_N2_COURSE_IDS = new Set([
  "00000000-0000-0000-0000-0000000c0006",
  "00000000-0000-0000-0000-0000000c0007",
  "00000000-0000-0000-0000-0000000c0008",
  "00000000-0000-0000-0000-0000000c0009",
  "00000000-0000-0000-0000-0000000c000a",
]);

export const N2_MONDAI_LABELS: Record<string, string> = {
  "1": "問題1 課題理解",
  "2": "問題2 ポイント理解",
  "3": "問題3 概要理解",
  "4": "問題4 即時応答",
  "5": "問題5 統合理解",
};

export interface N2LessonMeta {
  year: string;
  month: string;
  exam: string;
  mondai: string;
  question: number;
}

export function n2LessonMeta(lesson: Lesson): N2LessonMeta | null {
  const title = lesson.title.match(
    /^(\d{4})\/(\d{1,2})\s+問題([1-5])-(\d+)/u,
  );
  if (title) {
    const [, year, month, mondai, question] = title;
    return {
      year,
      month: month.padStart(2, "0"),
      exam: `${year}/${Number(month)}`,
      mondai,
      question: Number(question),
    };
  }

  const media = lesson.media_url?.match(
    /^\/audio\/n2\/(\d{4})-(\d{2})\/m([1-5])-q(\d+)\.mp3/u,
  );
  if (!media) return null;

  const [, year, month, mondai, question] = media;
  return {
    year,
    month,
    exam: `${year}/${Number(month)}`,
    mondai,
    question: Number(question),
  };
}

export function isN2Course(course: Course | null | undefined): boolean {
  return (
    course?.id === N2_COURSE_ID ||
    course?.slug === N2_COURSE_SLUG ||
    LEGACY_N2_COURSE_IDS.has(course?.id ?? "")
  );
}

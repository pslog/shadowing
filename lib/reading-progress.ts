export const READING_PROGRESS_EVENT = "shadowingjp:reading-progress";

export function readingProgressKey(lessonId: string): string {
  return `shadowingjp:reading-read:${lessonId}`;
}

export function isReadingLessonRead(lessonId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(readingProgressKey(lessonId)) === "1";
}

export function markReadingLessonRead(lessonId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(readingProgressKey(lessonId), "1");
  window.dispatchEvent(
    new CustomEvent(READING_PROGRESS_EVENT, { detail: { lessonId } }),
  );
}

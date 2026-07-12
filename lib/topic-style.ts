// Maps a lesson topic to a palette hue (CSS var) so each topic reads with a
// consistent accent colour across cards.

const HUES = [
  "var(--c-indigo)",
  "var(--c-violet)",
  "var(--c-sky)",
  "var(--c-emerald)",
  "var(--c-amber)",
  "var(--c-rose)",
] as const;

const MAP: Record<string, string> = {
  "Daily Standup": "var(--c-sky)",
  "朝会": "var(--c-sky)",
  "Code Review": "var(--c-violet)",
  "コードレビュー": "var(--c-violet)",
  "Bug Report": "var(--c-rose)",
  "バグ報告": "var(--c-rose)",
  "API Meeting": "var(--c-indigo)",
  "API会議": "var(--c-indigo)",
  Database: "var(--c-emerald)",
  "データベース": "var(--c-emerald)",
  Deployment: "var(--c-amber)",
  "デプロイ": "var(--c-amber)",
  BrSE: "var(--c-violet)",
  "ブリッジSE": "var(--c-violet)",
  Interview: "var(--c-sky)",
  "面接": "var(--c-sky)",
  Keigo: "var(--c-rose)",
  "敬語": "var(--c-rose)",
};

function hashHue(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

export function topicHue(topic: string | null | undefined): string {
  if (!topic) return HUES[0];
  if (MAP[topic]) return MAP[topic];
  return hashHue(topic);
}

/**
 * Hue for a lesson card. Keeps intentional per-topic colours (e.g. the IT
 * course), but when the topic is generic/unmapped (many lessons share one
 * topic like 会話), varies the colour per lesson using the title so a course's
 * cards aren't all the same shade.
 */
export function lessonHue(
  topic: string | null | undefined,
  seed: string | null | undefined,
): string {
  if (topic && MAP[topic]) return MAP[topic];
  return hashHue(seed || topic || "");
}

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

export function topicHue(topic: string | null | undefined): string {
  if (!topic) return HUES[0];
  if (MAP[topic]) return MAP[topic];
  // stable fallback by hashing the topic name
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

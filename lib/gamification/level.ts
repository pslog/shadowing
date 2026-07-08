// Level & title logic.

export const XP_PER_LEVEL = 500;

export function levelFromXp(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

/** XP into the current level and XP needed to reach the next. */
export function levelProgress(totalXp: number): {
  level: number;
  intoLevel: number;
  perLevel: number;
  toNext: number;
  pct: number;
} {
  const level = levelFromXp(totalXp);
  const intoLevel = totalXp % XP_PER_LEVEL;
  return {
    level,
    intoLevel,
    perLevel: XP_PER_LEVEL,
    toNext: XP_PER_LEVEL - intoLevel,
    pct: Math.round((intoLevel / XP_PER_LEVEL) * 100),
  };
}

const TITLES: { min: number; title: string }[] = [
  { min: 50, title: "テックリード話者" },
  { min: 30, title: "日本語ITコミュニケーター" },
  { min: 20, title: "BrSE候補" },
  { min: 15, title: "コードレビュー話者" },
  { min: 10, title: "朝会サバイバー" },
  { min: 5, title: "ジュニア開発者スピーカー" },
  { min: 1, title: "ITシャドーイング初心者" },
];

export function levelTitle(level: number): string {
  return TITLES.find((t) => level >= t.min)?.title ?? "ITシャドーイング初心者";
}

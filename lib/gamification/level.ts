// Level & title logic for general Japanese shadowing.

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export interface LevelMilestone {
  level: number;
  minXp: number;
  title: string;
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 1, minXp: 0, title: "リズム入門" },
  { level: 2, minXp: 100, title: "音をつかむ人" },
  { level: 3, minXp: 250, title: "まねして話す人" },
  { level: 4, minXp: 480, title: "リズム安定" },
  { level: 5, minXp: 800, title: "口が慣れてきた人" },
  { level: 6, minXp: 1250, title: "短文リアクター" },
  { level: 7, minXp: 1850, title: "イントネーション上達中" },
  { level: 8, minXp: 2650, title: "自然なスピード" },
  { level: 9, minXp: 3550, title: "発音が安定した人" },
  { level: 10, minXp: 4600, title: "会話に強い人" },
  { level: 15, minXp: 11000, title: "シャドーイング上級者" },
  { level: 20, minXp: 22000, title: "日本語スピーキングマスター" },
  { level: 30, minXp: 52000, title: "表現力の達人" },
  { level: 50, minXp: 140000, title: "シャドーイングレジェンド" },
];

/** Vietnamese rank names, keyed by the milestone level they belong to. */
const LEVEL_TITLES_VI: Record<number, string> = {
  1: "Nhập môn nhịp điệu",
  2: "Bắt được âm",
  3: "Nói theo được",
  4: "Nhịp điệu ổn định",
  5: "Miệng đã quen",
  6: "Phản xạ câu ngắn",
  7: "Ngữ điệu tiến bộ",
  8: "Tốc độ tự nhiên",
  9: "Phát âm ổn định",
  10: "Vững hội thoại",
  15: "Shadowing nâng cao",
  20: "Bậc thầy nói tiếng Nhật",
  30: "Cao thủ biểu đạt",
  50: "Huyền thoại Shadowing",
};

function xpForLevel(level: number): number {
  const known = LEVEL_MILESTONES.find((item) => item.level === level);
  if (known) return known.minXp;

  if (level < 1) return 0;

  const lower = LEVEL_MILESTONES.filter((item) => item.level < level).at(-1);
  const upper = LEVEL_MILESTONES.find((item) => item.level > level);
  if (lower && upper) {
    const step = (upper.minXp - lower.minXp) / (upper.level - lower.level);
    return Math.round(lower.minXp + step * (level - lower.level));
  }

  return 140000 + (level - 50) * 9000;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  for (let nextLevel = 2; xpForLevel(nextLevel) <= totalXp; nextLevel += 1) {
    level = nextLevel;
  }
  return level;
}

/** XP into the current level and XP needed to reach the next. */
export function levelProgress(totalXp: number): {
  level: number;
  intoLevel: number;
  perLevel: number;
  toNext: number;
  pct: number;
  currentMinXp: number;
  nextMinXp: number;
} {
  const level = levelFromXp(totalXp);
  const currentMinXp = xpForLevel(level);
  const nextMinXp = xpForLevel(level + 1);
  const perLevel = Math.max(1, nextMinXp - currentMinXp);
  const intoLevel = Math.max(0, totalXp - currentMinXp);
  const toNext = Math.max(0, nextMinXp - totalXp);
  return {
    level,
    intoLevel,
    perLevel,
    toNext,
    pct: Math.min(100, Math.round((intoLevel / perLevel) * 100)),
    currentMinXp,
    nextMinXp,
  };
}

export function levelTitle(level: number, locale: Locale = DEFAULT_LOCALE): string {
  const milestone =
    [...LEVEL_MILESTONES].reverse().find((item) => level >= item.level) ??
    LEVEL_MILESTONES[0];
  if (locale === "vi") {
    return LEVEL_TITLES_VI[milestone.level] ?? milestone.title;
  }
  return milestone.title;
}

export function visibleLevelMap(
  currentLevel: number,
  locale: Locale = DEFAULT_LOCALE,
): LevelMilestone[] {
  const nearby = new Set<number>();
  for (let level = 1; level <= 10; level += 1) nearby.add(level);
  [15, 20, 30, 50].forEach((level) => nearby.add(level));
  if (currentLevel > 10) {
    for (
      let level = Math.max(11, currentLevel - 1);
      level <= currentLevel + 2;
      level += 1
    ) {
      nearby.add(level);
    }
  }

  return [...nearby].sort((a, b) => a - b).map((level) => ({
    level,
    minXp: xpForLevel(level),
    title: levelTitle(level, locale),
  }));
}

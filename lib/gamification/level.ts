// Level & mascot logic for general Japanese shadowing.
//
// Each milestone is a Japanese mascot, climbing from cute everyday animals to
// legendary creatures so the ladder reads as a real progression. The artwork is
// vector (see `components/ui/mascot.tsx`) rather than raster: these render from
// 20px in the avatar menu up to 64px on the roadmap, and vector stays sharp at
// every size and DPI without shipping a single asset.
//
// `MascotSlug` is the contract between the two files — the art record is typed
// against it, so adding a milestone here fails the build until it is drawn.

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export type MascotSlug =
  | "hiyoko"
  | "kame"
  | "usagi"
  | "manekineko"
  | "tanuki"
  | "kitsune"
  | "saru"
  | "shika"
  | "tsuru"
  | "tora"
  | "shishi"
  | "tengu"
  | "hoo"
  | "ryu";

export interface Mascot {
  slug: MascotSlug;
  /** Design-token color driving the medallion halo behind the mascot. */
  accent: string;
}

export interface LevelMilestone {
  level: number;
  minXp: number;
  /** Japanese mascot name. */
  title: string;
  mascot: Mascot;
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  // Accents cycle through the six palette tokens so neighbours never share a
  // halo, and violet is held back for Lv.50 alone.
  { level: 1, minXp: 0, title: "ひよこ", mascot: { slug: "hiyoko", accent: "var(--c-amber)" } },
  { level: 2, minXp: 100, title: "かめ", mascot: { slug: "kame", accent: "var(--c-emerald)" } },
  { level: 3, minXp: 250, title: "うさぎ", mascot: { slug: "usagi", accent: "var(--c-rose)" } },
  { level: 4, minXp: 480, title: "招き猫", mascot: { slug: "manekineko", accent: "var(--c-sky)" } },
  { level: 5, minXp: 800, title: "たぬき", mascot: { slug: "tanuki", accent: "var(--c-indigo)" } },
  { level: 6, minXp: 1250, title: "きつね", mascot: { slug: "kitsune", accent: "var(--c-amber)" } },
  { level: 7, minXp: 1850, title: "さる", mascot: { slug: "saru", accent: "var(--c-rose)" } },
  { level: 8, minXp: 2650, title: "しか", mascot: { slug: "shika", accent: "var(--c-emerald)" } },
  { level: 9, minXp: 3550, title: "つる", mascot: { slug: "tsuru", accent: "var(--c-sky)" } },
  { level: 10, minXp: 4600, title: "とら", mascot: { slug: "tora", accent: "var(--c-amber)" } },
  { level: 15, minXp: 11000, title: "獅子", mascot: { slug: "shishi", accent: "var(--c-rose)" } },
  { level: 20, minXp: 22000, title: "天狗", mascot: { slug: "tengu", accent: "var(--c-indigo)" } },
  { level: 30, minXp: 52000, title: "鳳凰", mascot: { slug: "hoo", accent: "var(--c-amber)" } },
  { level: 50, minXp: 140000, title: "龍", mascot: { slug: "ryu", accent: "var(--c-violet)" } },
];

/** Vietnamese mascot names, keyed by the milestone level they belong to. */
const LEVEL_TITLES_VI: Record<number, string> = {
  1: "Gà con",
  2: "Rùa nhỏ",
  3: "Thỏ nhịp",
  4: "Mèo may mắn",
  5: "Tanuki",
  6: "Cáo Inari",
  7: "Khỉ Nikko",
  8: "Hươu Nara",
  9: "Sếu giấy",
  10: "Hổ hội thoại",
  15: "Sư tử đền",
  20: "Thiên cẩu",
  30: "Phượng hoàng",
  50: "Rồng",
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

/** Highest milestone the level has reached. Relies on ascending order. */
function milestoneFor(level: number): LevelMilestone {
  let reached = LEVEL_MILESTONES[0];
  for (const item of LEVEL_MILESTONES) {
    if (level < item.level) break;
    reached = item;
  }
  return reached;
}

export function levelTitle(level: number, locale: Locale = DEFAULT_LOCALE): string {
  const milestone = milestoneFor(level);
  if (locale === "vi") {
    return LEVEL_TITLES_VI[milestone.level] ?? milestone.title;
  }
  return milestone.title;
}

export function levelMascot(level: number): Mascot {
  return milestoneFor(level).mascot;
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
    mascot: levelMascot(level),
  }));
}

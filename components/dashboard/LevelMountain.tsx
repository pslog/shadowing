"use client";

// The whole level ladder as one climb up Fuji — every milestone on the same
// mountain, the learner somewhere along the trail.
//
// The ladder is fourteen milestones from ひよこ to 龍, and a progress bar throws
// that away: it gives a percentage but never shows that there IS a summit, or
// who is waiting further up. The progress page keeps the status-line reading of
// the same data (components/progress/MascotJourney.tsx); this is the whole map.
//
// Three things were learned the hard way drawing this, all worth keeping:
//
//   1. Fuji's exponent is BELOW one. `y = peak + drop · d^FLARE` with FLARE < 1
//      gives the steep cone and the wide flaring skirt. Above one flattens the
//      summit into a dome, which is what it looked like at FLARE = 1.75.
//   2. The trail belongs on the FACE, not along the ridge. A trail that follows
//      the silhouette leaves every mascot straddling the outline, half of it
//      hanging in the sky. Switchbacks across the face keep them on rock — and
//      buy the arc length fourteen stops need (~1020 units at LEGS 3.6, which
//      spaces the stops 64-80 apart for a 36-wide badge).
//   3. The viewBox aspect must match the container's, so the container is
//      `aspect-[1000/372]` and scrolls horizontally below its min width rather
//      than being squashed. An earlier version used `preserveAspectRatio="none"`
//      to force a fit; at 1080×320 that squeezed the cone 3.4:1 into a bump and
//      smeared every stroke. With the aspect locked, strokes and gradients are
//      safe, which is why the trail can be a dashed path instead of beads.

import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/components/i18n/useI18n";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MascotBadge } from "@/components/ui/mascot";
import { LEVEL_MILESTONES, levelTitle } from "@/lib/gamification/level";

// --- geometry, in viewBox units ------------------------------------------ //
const VW = 1000;
const VH = 344;
const PEAK_X = 500;
const PEAK_Y = 44;
/** Where the skirt reaches its full width. */
const BASE_Y = 296;
const HALF_W = 500;
/** < 1: steep summit, skirt flaring outward. See note 1 above. */
const FLARE = 0.66;
/** Snowline height. */
const CAP_Y = 100;

/** Switchback legs up the face, and how much of the available width each uses. */
const LEGS = 3.6;
// 0.84 rather than 0.66: the narrower swing left the right half of the canvas
// empty and pushed every stop into the lower-left. Measured at 0.84 the stops
// still sit 64+ units apart and none leaves the silhouette.
const SWING = 0.84;
const TRAIL_BASE_Y = 278;
const TRAIL_TOP_Y = 74;

function slopeY(x: number): number {
  const d = Math.min(1, Math.abs(x - PEAK_X) / HALF_W);
  return PEAK_Y + (BASE_Y - PEAK_Y) * Math.pow(d, FLARE);
}

/** How wide the cone is at height `y` — the trail may not leave it. */
function halfWidthAt(y: number): number {
  if (y <= PEAK_Y) return 0;
  const f = Math.min(1, (y - PEAK_Y) / (BASE_Y - PEAK_Y));
  return HALF_W * Math.pow(f, 1 / FLARE);
}

interface Point {
  x: number;
  y: number;
}

/** A point on the switchback trail. `u` is 0 at the base, 1 at the summit. */
function trailAt(u: number): Point {
  const c = Math.min(1, Math.max(0, u));
  const y = TRAIL_BASE_Y - (TRAIL_BASE_Y - TRAIL_TOP_Y) * c;
  const x = PEAK_X + -Math.cos(c * Math.PI * LEGS) * halfWidthAt(y) * SWING;
  return { x, y };
}

const CONE_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = PEAK_X - HALF_W + (2 * HALF_W * i) / 200;
    points.push(`${x.toFixed(1)} ${slopeY(x).toFixed(1)}`);
  }
  return `M ${points.join(" L ")} L ${PEAK_X + HALF_W} ${VH} L ${PEAK_X - HALF_W} ${VH} Z`;
})();

/** A softer, flatter cone — used for the ridges standing behind Fuji so the
    peak sits in a landscape instead of on a blank swatch. */
function ridgePath(peakX: number, peakY: number, halfW: number, flare = 0.85): string {
  const points: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = peakX - halfW + (2 * halfW * i) / 60;
    const d = Math.min(1, Math.abs(x - peakX) / halfW);
    const y = peakY + (BASE_Y + 10 - peakY) * Math.pow(d, flare);
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${points.join(" L ")} L ${peakX + halfW} ${VH} L ${peakX - halfW} ${VH} Z`;
}

const BACK_RIDGES = [ridgePath(120, 182, 340), ridgePath(900, 162, 310)];

/** The right half of the cone, laid over it at low opacity: one light source,
    so the silhouette reads as a volume rather than a flat triangle. */
const SHADE_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = PEAK_X + (HALF_W * i) / 100;
    points.push(`${x.toFixed(1)} ${slopeY(x).toFixed(1)}`);
  }
  return `M ${PEAK_X} ${PEAK_Y} L ${points.join(" L ")} L ${PEAK_X + HALF_W} ${VH} L ${PEAK_X} ${VH} Z`;
})();

/** Faint ridges fanning down from the summit. */
const RIDGE_LINES = [-0.62, -0.28, 0.3, 0.66].map((k) => {
  const endX = PEAK_X + k * HALF_W;
  const endY = slopeY(endX) + 6;
  const midX = PEAK_X + k * HALF_W * 0.42;
  const midY = (PEAK_Y + endY) / 2 - 14;
  return `M ${PEAK_X} ${PEAK_Y + 10} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
});

/** Foreground meadow: a soft band in front of the skirt. Drawn over the cone
    (never behind it) so the base of the mountain has something to stand on. */
const MEADOW_PATH = `M 0 ${VH - 30} Q 250 ${VH - 42} 500 ${VH - 32} Q 760 ${VH - 22} ${VW} ${VH - 38} L ${VW} ${VH} L 0 ${VH} Z`;

/** A stylised pine: two stacked crowns over a short trunk. */
function pinePath(x: number, y: number, k: number): string {
  return [
    `M ${x - 1.6 * k} ${y} L ${x + 1.6 * k} ${y} L ${x + 1.6 * k} ${y - 5 * k} L ${x - 1.6 * k} ${y - 5 * k} Z`,
    `M ${x - 9 * k} ${y - 4 * k} L ${x} ${y - 17 * k} L ${x + 9 * k} ${y - 4 * k} Z`,
    `M ${x - 7 * k} ${y - 12 * k} L ${x} ${y - 25 * k} L ${x + 7 * k} ${y - 12 * k} Z`,
  ].join(" ");
}

// Kept clear of x 60-150: that is where the climber's "you are here" chip sits.
const PINES = [
  { x: 26, k: 0.85 },
  { x: 214, k: 1 },
  { x: 300, k: 0.72 },
  { x: 392, k: 0.9 },
  { x: 676, k: 0.8 },
  { x: 770, k: 1.05 },
  { x: 872, k: 0.75 },
  { x: 958, k: 0.95 },
].map((tree) => pinePath(tree.x, VH - 14, tree.k));

/** Birds, because an empty upper-left corner is the thing that read as unfinished. */
const BIRDS = [
  "M 236 76 q 6 -5 12 0 q 6 -5 12 0",
  "M 286 56 q 5 -4 10 0 q 5 -4 10 0",
  "M 330 84 q 4 -3 8 0 q 4 -3 8 0",
];

const CLOUDS = [
  { x: 172, y: 84, s: 0.92, o: 0.72 },
  { x: 654, y: 52, s: 0.68, o: 0.58 },
  { x: 838, y: 250, s: 1.1, o: 0.32 },
];

const SNOW_PATH = (() => {
  const dx = halfWidthAt(CAP_Y);
  const points: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = PEAK_X - dx + (2 * dx * i) / 40;
    points.push(`${x.toFixed(1)} ${slopeY(x).toFixed(1)}`);
  }
  // Walk the snowline back with a shallow scallop, so it is not a ruled line.
  for (let i = 0; i <= 10; i++) {
    const f = 1 - i / 10;
    const x = PEAK_X - dx + 2 * dx * f;
    points.push(`${x.toFixed(1)} ${(CAP_Y + 6 * Math.sin(f * Math.PI * 2.5)).toFixed(1)}`);
  }
  return `M ${points.join(" L ")} Z`;
})();

/** Trail samples plus the cumulative arc length, for evenly spaced stops. */
const TRAIL = (() => {
  const steps = 900;
  const pts: Point[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= steps; i++) {
    const p = trailAt(i / steps);
    pts.push(p);
    if (i > 0) {
      const prev = pts[i - 1];
      cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    }
  }
  return { pts, cum, total: cum[cum.length - 1] };
})();

/** The point `t` of the way along the trail by arc length (not by parameter). */
function atArc(t: number): Point {
  const target = Math.min(1, Math.max(0, t)) * TRAIL.total;
  let lo = 0;
  let hi = TRAIL.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (TRAIL.cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return TRAIL.pts[lo];
}

function pathThrough(from: number, to: number): string {
  const step = 1 / 240;
  const parts: string[] = [];
  for (let t = from; t <= to + 1e-9; t += step) {
    const p = atArc(Math.min(t, to));
    parts.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return parts.length > 1 ? `M ${parts.join(" L ")}` : "";
}

const LAST = LEVEL_MILESTONES.length - 1;
/** Stop positions, spaced by equal arc length. */
const STOPS = LEVEL_MILESTONES.map((_, index) => atArc(index / LAST));

export function LevelMountain({
  currentLevel,
  totalXp,
}: {
  currentLevel: number;
  totalXp: number;
}) {
  const { locale, localeTag, dictionary } = useI18n();
  const t = dictionary.progress;

  let currentIndex = 0;
  for (let i = 0; i <= LAST; i++) {
    if (LEVEL_MILESTONES[i].level <= currentLevel) currentIndex = i;
  }
  const currentMilestone = LEVEL_MILESTONES[currentIndex];
  const nextMilestone = LEVEL_MILESTONES[currentIndex + 1];

  const span = nextMilestone
    ? Math.max(1, nextMilestone.minXp - currentMilestone.minXp)
    : 1;
  const pct = nextMilestone
    ? Math.min(100, Math.max(0, Math.round(((totalXp - currentMilestone.minXp) / span) * 100)))
    : 100;
  const remaining = nextMilestone ? Math.max(0, nextMilestone.minXp - totalXp) : 0;

  // Position between milestones, so XP earned inside a level visibly moves the
  // climber instead of parking it on a dot until the level flips.
  const climbedT = (currentIndex + (nextMilestone ? pct / 100 : 0)) / LAST;
  const climber = useMemo(() => atArc(climbedT), [climbedT]);
  const climbedPath = useMemo(() => pathThrough(0, climbedT), [climbedT]);

  // Bring the learner's own milestone into view in the phone rail; without it
  // a Lv.1 learner sees the start and a Lv.30 learner sees somebody else's.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = stripRef.current;
    const current = rail?.querySelector<HTMLElement>('[data-current="true"]');
    if (!rail || !current) return;
    rail.scrollLeft = Math.max(
      0,
      current.offsetLeft - rail.clientWidth / 2 + current.offsetWidth / 2,
    );
  }, [currentIndex]);

  const at = (p: Point) => ({
    left: `${(p.x / VW) * 100}%`,
    top: `${(p.y / VH) * 100}%`,
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="text-base font-extrabold tracking-[-0.02em] sm:text-lg">
            {t.climbTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {nextMilestone
              ? `${t.remainingXp(remaining.toLocaleString(localeTag))} · ${t.toNextLevel(nextMilestone.level)}`
              : t.maxLevel}
          </p>
          {/* Says out loud what the greyed mascots up the slope are. */}
          <p className="mt-0.5 text-[11px] leading-5 text-muted/80">
            {t.climbBody(LEVEL_MILESTONES.length)}
          </p>
        </div>
        <span className="brand-gradient shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold tabular-nums text-white shadow-[var(--shadow-accent)]">
          Lv.{currentLevel} · {pct}%
        </span>
      </div>

      {/* Below ~900px the climb scrolls instead of being squashed: fourteen
          stops need the width, and squashing is what made this unreadable. */}
      <div className="mt-3 hidden overflow-x-auto px-4 pb-4 md:block sm:px-5 sm:pb-5">
        <div
          className="relative min-w-[672px] overflow-hidden rounded-2xl border border-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),var(--shadow-sm)]"
          style={{ aspectRatio: `${VW} / ${VH}` }}
          role="img"
          aria-label={`${t.climbTitle} — Lv.${currentLevel} ${levelTitle(currentLevel, locale)}`}
        >
          <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" aria-hidden>
            {/* Colors go through `style`, not fill/stop-color attributes:
                presentation attributes do not reliably accept color-mix(). */}
            <defs>
              <linearGradient id="fuji-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--g1) 30%, var(--card))" }} />
                <stop offset="40%" style={{ stopColor: "color-mix(in srgb, var(--c-sky) 20%, var(--card))" }} />
                <stop offset="74%" style={{ stopColor: "color-mix(in srgb, var(--g3) 16%, var(--card))" }} />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--c-amber) 24%, var(--card))" }} />
              </linearGradient>
              {/* A low sun: the sky needs one light source for the cone's
                  shading to mean anything. */}
              <radialGradient id="fuji-sun" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--c-amber) 62%, white)", stopOpacity: 0.9 }} />
                <stop offset="52%" style={{ stopColor: "color-mix(in srgb, var(--g3) 55%, white)", stopOpacity: 0.42 }} />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--g3) 45%, white)", stopOpacity: 0 }} />
              </radialGradient>
              {/* Light from the left. A gradient gives the cone its form without
                  the hard peak-to-base seam a two-polygon split leaves behind. */}
              <linearGradient id="fuji-cone" x1="0" y1="0" x2="1" y2="0.4">
                <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--g2) 50%, var(--card))" }} />
                <stop offset="52%" style={{ stopColor: "color-mix(in srgb, var(--g1) 62%, var(--card))" }} />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--primary) 74%, var(--card))" }} />
              </linearGradient>
              <linearGradient id="fuji-shade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(24,12,56,0)" />
                <stop offset="100%" stopColor="rgba(24,12,56,0.26)" />
              </linearGradient>
              <linearGradient id="fuji-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--c-emerald) 54%, var(--card))" }} />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--c-emerald) 28%, var(--card))" }} />
              </linearGradient>
              <linearGradient id="fuji-snow" x1="0" y1="0" x2="1" y2="0.6">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--c-sky) 22%, white)" }} />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={VW} height={VH} fill="url(#fuji-sky)" />
            <circle cx="836" cy="96" r="118" fill="url(#fuji-sun)" />
            <circle
              cx="836"
              cy="96"
              r="33"
              opacity="0.92"
              style={{ fill: "color-mix(in srgb, var(--c-amber) 40%, white)" }}
            />

            {CLOUDS.map((cloud) => (
              <g
                key={`${cloud.x}-${cloud.y}`}
                opacity={cloud.o}
                transform={`translate(${cloud.x} ${cloud.y}) scale(${cloud.s})`}
              >
                <ellipse cx="0" cy="0" rx="44" ry="14" fill="#ffffff" />
                <ellipse cx="-26" cy="6" rx="28" ry="10" fill="#ffffff" />
                <ellipse cx="28" cy="5" rx="33" ry="11" fill="#ffffff" />
              </g>
            ))}

            {/* Ridges behind the peak: depth, and they stop the sky from being
                one empty gradient across the whole card. */}
            {BACK_RIDGES.map((d, index) => (
              <path
                key={`ridge-${index}`}
                d={d}
                opacity={0.5}
                style={{ fill: "color-mix(in srgb, var(--g1) 32%, var(--card))" }}
              />
            ))}

            {/* A horizon. Without it the skirt stops short of the frame and the
                bottom corners show sky, which reads as the mountain floating. */}
            <rect x="0" y={BASE_Y} width={VW} height={VH - BASE_Y} fill="url(#fuji-ground)" />
            <path d={CONE_PATH} fill="url(#fuji-cone)" />
            <path d={SHADE_PATH} fill="url(#fuji-shade)" />
            {RIDGE_LINES.map((d, index) => (
              <path
                key={`line-${index}`}
                d={d}
                fill="none"
                stroke="rgba(255,255,255,0.17)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
            <path d={SNOW_PATH} fill="url(#fuji-snow)" />
            <path d={MEADOW_PATH} fill="url(#fuji-ground)" />
            {PINES.map((d, index) => (
              <path
                key={`pine-${index}`}
                d={d}
                style={{ fill: "color-mix(in srgb, var(--c-emerald) 74%, black)" }}
                opacity={0.62}
              />
            ))}

            {/* A torii at the trailhead: the climb starts somewhere. */}
            <g style={{ fill: "color-mix(in srgb, var(--danger) 76%, white)" }} opacity={0.9}>
              <rect x="586" y={VH - 44} width="4.5" height="30" />
              <rect x="613" y={VH - 44} width="4.5" height="30" />
              <rect x="578" y={VH - 50} width="48" height="5" rx="2" />
              <rect x="583" y={VH - 39} width="38" height="4" rx="1.5" />
            </g>

            {BIRDS.map((d, index) => (
              <path
                key={`bird-${index}`}
                d={d}
                fill="none"
                stroke="color-mix(in srgb, var(--fg) 34%, transparent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}

            {/* A flag on the summit — the top of the ladder should look like a
                destination, not the place the drawing happens to stop. */}
            <line
              x1={PEAK_X}
              y1={PEAK_Y + 2}
              x2={PEAK_X}
              y2={PEAK_Y - 30}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d={`M ${PEAK_X + 1} ${PEAK_Y - 29} L ${PEAK_X + 27} ${PEAK_Y - 22} L ${PEAK_X + 1} ${PEAK_Y - 15} Z`}
              style={{ fill: "color-mix(in srgb, var(--c-amber) 55%, white)" }}
            />

            {/* The trail is white now, not dark ink: on a saturated cone the old
                --fg dashes disappeared into the rock. */}
            <path
              d={pathThrough(0, 1)}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="3"
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            {climbedPath && (
              <>
                <path
                  d={climbedPath}
                  fill="none"
                  stroke="rgba(255,255,255,0.32)"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path
                  d={climbedPath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.6"
                  strokeDasharray="1 6"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>

          {LEVEL_MILESTONES.map((milestone, index) => {
            const isCurrent = index === currentIndex;
            const isNext = index === currentIndex + 1;
            const size = isCurrent ? 50 : isNext ? 40 : 34;
            return (
              <span
                key={milestone.level}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ ...at(STOPS[index]), zIndex: isCurrent ? 3 : isNext ? 2 : 1 }}
                title={`Lv.${milestone.level} · ${levelTitle(milestone.level, locale)}`}
              >
                {isCurrent && (
                  <span
                    aria-hidden
                    className="animate-ring absolute inset-0 rounded-full"
                    style={{
                      boxShadow: `0 0 0 3px color-mix(in srgb, ${milestone.mascot.accent} 50%, transparent)`,
                    }}
                  />
                )}
                <MascotBadge
                  slug={milestone.mascot.slug}
                  accent={milestone.mascot.accent}
                  size={size}
                />
                {!isCurrent && (
                  <span
                    className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-full bg-card/80 px-1.5 py-px text-[9px] font-black tabular-nums text-fg/75 backdrop-blur-sm"
                  >
                    Lv.{milestone.level}
                  </span>
                )}
              </span>
            );
          })}

          <span
            className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-black text-primary shadow-[var(--shadow-sm)] backdrop-blur-sm"
            style={{
              left: at(climber).left,
              top: `${(Math.min(VH - 14, climber.y + 34) / VH) * 100}%`,
              zIndex: 4,
            }}
          >
            {t.roadmapHere}
          </span>

          <span
            className="absolute flex items-center gap-1 whitespace-nowrap rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-fg/75 backdrop-blur-sm"
            style={{ left: `${((PEAK_X + 46) / VW) * 100}%`, top: `${((PEAK_Y - 4) / VH) * 100}%` }}
          >
            <Icon name="star" size={11} filled />
            {t.roadmapMountain}
          </span>
        </div>
      </div>

      {/* Phone layout: the same ladder as a swipeable rail. Every milestone
          keeps its mascot, its level and its name at a readable size, and the
          current one is scrolled into view on mount. */}
      <div className="mt-3 px-4 pb-4 md:hidden">
        <div className="bar-track h-2" aria-hidden>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div
          ref={stripRef}
          className="mt-3 flex snap-x gap-2.5 overflow-x-auto pb-1"
          role="list"
        >
          {LEVEL_MILESTONES.map((milestone, index) => {
            const isCurrent = index === currentIndex;
            return (
              <div
                key={milestone.level}
                role="listitem"
                data-current={isCurrent ? "true" : undefined}
                className={`relative flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 ${
                  isCurrent
                    ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] shadow-[var(--shadow-sm)]"
                    : "border-border bg-surface"
                }`}
              >
                <MascotBadge
                  slug={milestone.mascot.slug}
                  accent={milestone.mascot.accent}
                  size={isCurrent ? 44 : 36}
                />
                <span className="text-[10px] font-black tabular-nums text-fg/80">
                  Lv.{milestone.level}
                </span>
                <span
                  lang="ja"
                  className="w-full truncate text-center text-[10px] leading-4 text-muted"
                >
                  {levelTitle(milestone.level, locale)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 border-t border-border bg-[color-mix(in_srgb,var(--surface)_60%,var(--card))] p-4 sm:grid-cols-2 sm:p-5">
        <div className="flex items-center gap-3">
          <MascotBadge
            slug={currentMilestone.mascot.slug}
            accent={currentMilestone.mascot.accent}
            size={44}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              {t.currentPosition}
            </p>
            <p className="truncate text-sm font-extrabold">
              Lv.{currentLevel} · {levelTitle(currentLevel, locale)}
            </p>
          </div>
        </div>

        {nextMilestone ? (
          <div className="flex items-center gap-3 sm:justify-end">
            <MascotBadge
              slug={nextMilestone.mascot.slug}
              accent={nextMilestone.mascot.accent}
              size={44}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {t.nextCompanion}
              </p>
              <p className="truncate text-sm font-extrabold text-muted">
                Lv.{nextMilestone.level} · {levelTitle(nextMilestone.level, locale)}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-bold text-primary sm:justify-end">
            <Icon name="trophy" size={16} filled />
            {t.maxLevel}
          </p>
        )}
      </div>
    </Card>
  );
}

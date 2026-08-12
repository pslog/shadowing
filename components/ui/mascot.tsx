import Image from "next/image";
import { cn } from "@/lib/cn";
import { MASCOT_ART } from "@/lib/gamification/mascot-art";
import type { MascotSlug } from "@/lib/gamification/level";

// Below this pixel size the raster art is skipped even when it exists: a 512px
// illustration downscaled to a 22px menu glyph turns to mush, while the vector
// stays readable. Raster wins on the big card, vector wins in the menu.
const MIN_RASTER_SIZE = 30;

// Hand-drawn mascots on a 48x48 grid, cel-shaded rather than flat.
//
// How the volume is built without gradients or <defs>: <Head> draws the shade
// tone first at full size (carrying the contour stroke), then the base tone
// inset up-left. The shade tone peeking out along the lower right IS the
// shadow. This is deliberate — gradients and clip paths need element ids, and
// a mascot rendered 14 times on the roadmap would emit 14 duplicate ids.
//
// Rules that keep the set coherent:
//   - one front-facing head filling roughly x=6..42, y=6..42
//   - the contour is a dark tone OF THE MASCOT'S OWN COLOR (`line`), not one
//     universal black. A single black ink weight reads as sticker cartoon; a
//     colored contour reads as painted while keeping the same crispness.
//   - <Eyes> carries two catchlights — a big one upper right for the key light
//     and a faint one lower left for bounce. One light direction for the set.
//   - exactly one signature feature per mascot (beak, antlers, long nose),
//     because anything more turns to mush once the badge shrinks
// Fur/feather colors are literal hex, not theme tokens: a fox must stay orange
// in dark mode. Only the halo behind the mascot follows the palette.

const PUPIL = "#2b2637";

interface Tones {
  base: string;
  shade: string;
  line: string;
}

const TONES: Record<MascotSlug, Tones> = {
  hiyoko: { base: "#fbd14b", shade: "#eab52a", line: "#b07617" },
  // Yellow-green, deliberately away from the dragon's jade so Lv.2 and Lv.50
  // never read as the same creature at badge size.
  kame: { base: "#84cf62", shade: "#69b449", line: "#3c7529" },
  usagi: { base: "#fdfafd", shade: "#e9e0ec", line: "#a297a8" },
  manekineko: { base: "#fdfafd", shade: "#e9e0ec", line: "#a297a8" },
  tanuki: { base: "#ab875f", shade: "#8f6e4b", line: "#57402d" },
  kitsune: { base: "#f4983f", shade: "#df7d24", line: "#984f11" },
  saru: { base: "#a48264", shade: "#8a6a50", line: "#57402d" },
  shika: { base: "#d0a774", shade: "#b78c58", line: "#775432" },
  tsuru: { base: "#fdfafd", shade: "#e6dee9", line: "#98909f" },
  tora: { base: "#f7ae3e", shade: "#e39424", line: "#985c0e" },
  shishi: { base: "#dc4762", shade: "#c1344f", line: "#7f1c30" },
  tengu: { base: "#e2523f", shade: "#c93a28", line: "#832015" },
  hoo: { base: "#e34331", shade: "#c72e1d", line: "#821d11" },
  ryu: { base: "#37b787", shade: "#219a6c", line: "#0f6b4b" },
};

/** Contour group for the outer silhouette. Draw ears first, head last. */
function Ink({ line, children }: { line: string; children: React.ReactNode }) {
  return (
    <g stroke={line} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

/**
 * Two-tone head. The shade ellipse sits slightly down-right of the base one, so
 * the sliver left showing reads as the shadowed side.
 */
function Head({
  cx = 24,
  cy = 27,
  rx = 13,
  ry = 12.2,
  tones,
  rim = true,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  tones: Tones;
  rim?: boolean;
}) {
  return (
    <>
      <ellipse cx={cx + 0.8} cy={cy + 1} rx={rx} ry={ry} fill={tones.shade} />
      <ellipse cx={cx - 0.5} cy={cy - 0.9} rx={rx - 1.2} ry={ry - 1.2} fill={tones.base} />
      {rim && (
        <ellipse
          cx={cx - rx * 0.44}
          cy={cy - ry * 0.52}
          rx={rx * 0.32}
          ry={ry * 0.2}
          fill="#fff"
          opacity="0.34"
          transform={`rotate(-28 ${cx - rx * 0.44} ${cy - ry * 0.52})`}
        />
      )}
    </>
  );
}

/** Silhouette outline for a head drawn by <Head>, stroked but not filled. */
function HeadLine({
  cx = 24,
  cy = 27,
  rx = 13,
  ry = 12.2,
  line,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  line: string;
}) {
  return (
    <ellipse
      cx={cx + 0.8}
      cy={cy + 1}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={line}
      strokeWidth="1.6"
    />
  );
}

function Eyes({ y = 24, dx = 4.6, r = 2.05 }: { y?: number; dx?: number; r?: number }) {
  return (
    <>
      {[24 - dx, 24 + dx].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={y} r={r} fill={PUPIL} />
          <circle cx={cx + r * 0.32} cy={y - r * 0.4} r={r * 0.34} fill="#fff" opacity="0.95" />
          <circle cx={cx - r * 0.36} cy={y + r * 0.42} r={r * 0.17} fill="#fff" opacity="0.45" />
        </g>
      ))}
    </>
  );
}

function Blush({ y = 29, dx = 8.4, color = "#f0788f" }: { y?: number; dx?: number; color?: string }) {
  return (
    <>
      <ellipse cx={24 - dx} cy={y} rx="2.8" ry="1.9" fill={color} opacity="0.5" />
      <ellipse cx={24 + dx} cy={y} rx="2.8" ry="1.9" fill={color} opacity="0.5" />
    </>
  );
}

const ART: Record<MascotSlug, React.ReactNode> = {
  // Lv.1 — chick: round body, tuft, downward beak.
  hiyoko: (() => {
    const t = TONES.hiyoko;
    return (
      <>
        <Ink line={t.line}>
          <path d="M23.8 12.5c-.4-2.6.6-4.4 2.6-5-.6 2.4-.4 4 .4 5z" fill={t.shade} />
          <ellipse cx="13.4" cy="27.8" rx="4.1" ry="5.5" fill={t.shade} />
        </Ink>
        <Head cy={26.5} rx={13} ry={12.6} tones={t} />
        <HeadLine cy={26.5} rx={13} ry={12.6} line={t.line} />
        <Blush y={30.5} dx={8.8} />
        <Eyes y={23.5} dx={4.4} />
        <path d="M20.2 27.2h7.6L24 32.6z" fill="#f0821e" stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M21.6 28.4h4.8L24 30.6z" fill="#fbb35c" />
        <path d="M20 39.6v2.2M28 39.6v2.2" stroke={t.line} strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  })(),

  // Lv.2 — turtle: the shell is the signature, so it carries its own amber tone
  // family instead of a shade of the head, and the head sits in front of it.
  kame: (() => {
    const t = TONES.kame;
    return (
      <>
        {/* Domed shell BEHIND the head, wider than it, so the turtle reads as
            peeking out of the shell. Flat and low it looked like a mound. */}
        <Ink line="#8a5f1e">
          <ellipse cx="24" cy="29.5" rx="15.4" ry="13.2" fill="#c08a3a" />
        </Ink>
        <ellipse cx="23.4" cy="28.6" rx="14" ry="11.8" fill="#dda958" />
        {/* Marginal-scute band plus radial seams: the pattern that says "shell". */}
        <ellipse cx="23.7" cy="28.8" rx="9.8" ry="8.2" fill="none" stroke="#a5731f" strokeWidth="1.2" opacity="0.8" />
        <path d="M8.8 29.4h4.6M39.2 29.4H34.6M13.6 37.6l3.2-2.8M34.4 37.6l-3.2-2.8" stroke="#a5731f" strokeWidth="1.15" strokeLinecap="round" opacity="0.75" />
        <Head cy={21.5} rx={11.2} ry={10.6} tones={t} />
        <HeadLine cy={21.5} rx={11.2} ry={10.6} line={t.line} />
        <Blush y={24} dx={7.4} color="#e08a3a" />
        <Eyes y={20} dx={4.2} />
        <circle cx="22.5" cy="24.8" r="0.8" fill={t.line} />
        <circle cx="25.5" cy="24.8" r="0.8" fill={t.line} />
        <path d="M21 27.2q3 2.4 6 0" stroke={t.line} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </>
    );
  })(),

  // Lv.3 — rabbit: two tall ears.
  usagi: (() => {
    const t = TONES.usagi;
    return (
      <>
        <Ink line={t.line}>
          <ellipse cx="18.4" cy="13.6" rx="3.8" ry="8.8" fill={t.shade} />
          <ellipse cx="29.6" cy="13.6" rx="3.8" ry="8.8" fill={t.shade} />
        </Ink>
        <ellipse cx="18" cy="13.2" rx="2.9" ry="7.9" fill={t.base} />
        <ellipse cx="29.2" cy="13.2" rx="2.9" ry="7.9" fill={t.base} />
        <ellipse cx="18.3" cy="14" rx="1.7" ry="6" fill="#f4a3b9" />
        <ellipse cx="29.5" cy="14" rx="1.7" ry="6" fill="#f4a3b9" />
        <Head cy={30} rx={12.6} ry={11.8} tones={t} />
        <HeadLine cy={30} rx={12.6} ry={11.8} line={t.line} />
        <Blush y={32.4} dx={8.4} />
        <Eyes y={28.5} dx={4.6} />
        <path d="M22.4 32.4h3.2L24 34.8z" fill="#ee7089" stroke={t.line} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M24 34.8v1.6M24 36.4q-2.2 1.8-3.8 0M24 36.4q2.2 1.8 3.8 0" stroke={t.line} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </>
    );
  })(),

  // Lv.4 — lucky cat: raised paw, collar, bell.
  manekineko: (() => {
    const t = TONES.manekineko;
    return (
      <>
        <Ink line={t.line}>
          <path d="M12.6 20.4 15.4 9l6.8 6.4z" fill={t.shade} />
          <path d="M35.4 20.4 32.6 9l-6.8 6.4z" fill={t.shade} />
          <ellipse cx="37" cy="31.5" rx="3.9" ry="4.7" fill={t.base} transform="rotate(18 37 31.5)" />
        </Ink>
        <ellipse cx="37.4" cy="32.6" rx="2.2" ry="2.4" fill="#f4a3b9" transform="rotate(18 37.4 32.6)" />
        <path d="M15.4 17.8 16.9 11.6l4 4z" fill={t.base} />
        <path d="M32.6 17.8 31.1 11.6l-4 4z" fill={t.base} />
        <path d="M15.8 17.2 16.9 12.6 19.9 15.6z" fill="#f4a3b9" />
        <path d="M32.2 17.2 31.1 12.6 28.1 15.6z" fill="#f4a3b9" />
        <Head cy={27} rx={13} ry={12.2} tones={t} />
        <HeadLine cy={27} rx={13} ry={12.2} line={t.line} />
        <Eyes y={25} dx={4.6} />
        <path d="M12.6 23.4 8.2 21.8M12.6 26.6 8.2 26.8M35.4 23.4 39.8 21.8M35.4 26.6 39.8 26.8" stroke={t.line} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        <path d="M22.7 28.9h2.6L24 30.8z" fill="#ee7089" stroke={t.line} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M24 30.8v1.3M24 32.1q-2 1.6-3.4 0M24 32.1q2 1.6 3.4 0" stroke={t.line} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M14.4 36.4q9.6 4.2 19.2 0" stroke="#c02a44" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        <path d="M14.9 35.7q9.1 3.9 18.2 0" stroke="#e6465f" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <circle cx="24" cy="38.7" r="3.1" fill="#eab52a" stroke="#a3700f" strokeWidth="1.3" />
        <circle cx="22.9" cy="37.6" r="1" fill="#fbe08a" />
        <path d="M24 36.9v3.6" stroke="#a3700f" strokeWidth="1.1" strokeLinecap="round" />
      </>
    );
  })(),

  // Lv.5 — tanuki: dark eye mask, leaf on the head.
  tanuki: (() => {
    const t = TONES.tanuki;
    return (
      <>
        <Ink line={t.line}>
          <path d="M12.4 19.4 13.6 10.6 20.4 16z" fill={t.shade} />
          <path d="M35.6 19.4 34.4 10.6 27.6 16z" fill={t.shade} />
        </Ink>
        <Head cy={27} rx={13} ry={12.2} tones={t} />
        <HeadLine cy={27} rx={13} ry={12.2} line={t.line} />
        <ellipse cx="18.2" cy="24.6" rx="4.9" ry="4.3" fill="#463629" transform="rotate(-8 18.2 24.6)" />
        <ellipse cx="29.8" cy="24.6" rx="4.9" ry="4.3" fill="#463629" transform="rotate(8 29.8 24.6)" />
        <circle cx="18.4" cy="24.4" r="2" fill="#f7f1ea" />
        <circle cx="29.6" cy="24.4" r="2" fill="#f7f1ea" />
        <circle cx="18.6" cy="24.6" r="1.3" fill={PUPIL} />
        <circle cx="29.4" cy="24.6" r="1.3" fill={PUPIL} />
        <circle cx="19.15" cy="23.9" r="0.5" fill="#fff" />
        <circle cx="29.95" cy="23.9" r="0.5" fill="#fff" />
        <ellipse cx="24" cy="32.4" rx="6.7" ry="4.9" fill="#e6d0b2" />
        <ellipse cx="23.5" cy="31.6" rx="5.6" ry="3.9" fill="#f4e6d2" />
        <ellipse cx="24" cy="30.5" rx="2.2" ry="1.6" fill={PUPIL} />
        <path d="M22 33.9q2 1.8 4 0" stroke="#6b5140" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M24.4 12.4q4.6-4.2 7.8-1.6-1.6 4.8-7.8 1.6z" fill="#3fc08d" stroke="#177a55" strokeWidth="1.3" strokeLinejoin="round" />
      </>
    );
  })(),

  // Lv.6 — fox: sharp ears, white muzzle, narrow eyes.
  kitsune: (() => {
    const t = TONES.kitsune;
    return (
      <>
        <Ink line={t.line}>
          <path d="M11.4 21.4 13.2 8.6 21.4 16z" fill={t.shade} />
          <path d="M36.6 21.4 34.8 8.6 26.6 16z" fill={t.shade} />
        </Ink>
        <path d="M12.6 20 13.8 10.6l6.2 5.6z" fill={t.base} />
        <path d="M35.4 20 34.2 10.6l-6.2 5.6z" fill={t.base} />
        <path d="M14.2 17.6 15 12.2 18.8 15.8z" fill="#463629" />
        <path d="M33.8 17.6 33 12.2 29.2 15.8z" fill="#463629" />
        <Head cy={27} rx={13} ry={11.8} tones={t} />
        <HeadLine cy={27} rx={13} ry={11.8} line={t.line} />
        <path d="M24 38.7q-8.3-1.8-8.3-8.5 8.3-2.4 16.6 0 0 6.7-8.3 8.5z" fill="#e9e0ec" />
        <path d="M24 37.6q-7.2-1.6-7.2-7.4 7.2-2.1 14.4 0 0 5.8-7.2 7.4z" fill="#fdfafd" />
        <path d="M17.4 24.2q2.8-1.8 4.8.4M30.6 24.2q-2.8-1.8-4.8.4" stroke={PUPIL} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M22.2 30.6h3.6L24 32.9z" fill={PUPIL} />
        <path d="M24 32.9v1.4M24 34.3q-2.2 1.8-3.8 0M24 34.3q2.2 1.8 3.8 0" stroke={PUPIL} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </>
    );
  })(),

  // Lv.7 — macaque: ears on the sides, red face (Japanese snow monkey).
  saru: (() => {
    const t = TONES.saru;
    return (
      <>
        <Ink line={t.line}>
          <circle cx="10.4" cy="26" r="4.7" fill={t.shade} />
          <circle cx="37.6" cy="26" r="4.7" fill={t.shade} />
        </Ink>
        <circle cx="10.4" cy="26" r="2.4" fill="#dda388" />
        <circle cx="37.6" cy="26" r="2.4" fill="#dda388" />
        <Head cy={26} rx={13} ry={12.6} tones={t} />
        <HeadLine cy={26} rx={13} ry={12.6} line={t.line} />
        <ellipse cx="24.4" cy="28.8" rx="9.7" ry="9.9" fill="#e08b7c" />
        <ellipse cx="23.7" cy="28" rx="8.7" ry="9" fill="#f5a898" />
        <Eyes y={24} dx={4.2} />
        <Blush y={30.6} dx={7.2} color="#dd5a49" />
        <ellipse cx="22.6" cy="29.9" rx="1" ry="1.25" fill="#a85c4e" />
        <ellipse cx="25.4" cy="29.9" rx="1" ry="1.25" fill="#a85c4e" />
        <path d="M20.2 33.5q3.8 3 7.6 0" stroke="#a85c4e" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </>
    );
  })(),

  // Lv.8 — Nara deer: antlers and dappled flank.
  shika: (() => {
    const t = TONES.shika;
    return (
      <>
        <path d="M17 15.5 14 7.6m3 3.5L11.2 9.6m5.8 5.9 4.2-4.2" stroke="#6f4f30" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M31 15.5 34 7.6m-3 3.5 5.8-1.5m-5.8 5.9-4.2-4.2" stroke="#6f4f30" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Ink line={t.line}>
          <ellipse cx="14.2" cy="21.4" rx="3.3" ry="4.5" fill={t.shade} transform="rotate(-22 14.2 21.4)" />
          <ellipse cx="33.8" cy="21.4" rx="3.3" ry="4.5" fill={t.shade} transform="rotate(22 33.8 21.4)" />
        </Ink>
        <Head cy={29} rx={12.2} ry={12.2} tones={t} />
        <HeadLine cy={29} rx={12.2} ry={12.2} line={t.line} />
        <circle cx="16.6" cy="32.8" r="1.7" fill="#f6e7ce" opacity="0.9" />
        <circle cx="31.4" cy="32.8" r="1.7" fill="#f6e7ce" opacity="0.9" />
        <circle cx="19.2" cy="37.2" r="1.3" fill="#f6e7ce" opacity="0.9" />
        <circle cx="28.8" cy="37.2" r="1.3" fill="#f6e7ce" opacity="0.9" />
        <Eyes y={27} dx={4.8} />
        <path d="M24 32.6q-3.2 0-3.2 2.6 0 2.2 3.2 2.2t3.2-2.2q0-2.6-3.2-2.6z" fill="#5f4a3a" />
        <path d="M23.6 32.8q-2.4.2-2.4 2.2 0 1 .9 1.6-.5-2.4 1.5-3.8z" fill="#7d6553" />
        <ellipse cx="24" cy="33.9" rx="2.1" ry="1.4" fill={PUPIL} />
      </>
    );
  })(),

  // Lv.9 — crane: red crown plus one bill. The bill stays inside the white head
  // so it survives a dark halo, and there are no side strokes — they read as
  // walrus tusks once the badge shrinks.
  tsuru: (() => {
    const t = TONES.tsuru;
    return (
      <>
        <Head cy={24.5} rx={12.6} ry={13} tones={t} />
        <HeadLine cy={24.5} rx={12.6} ry={13} line={t.line} />
        <path d="M24 10.8q6 0 6.8 6-6.8-2.6-13.6 0 .8-6 6.8-6z" fill="#d63a52" stroke="#8a1f30" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M23.4 11.9q-4.2.6-5 4.3 2.6-.9 5.4-1.1z" fill="#ef5d75" />
        <Eyes y={23.5} dx={4.9} />
        <path d="M21.5 28h5L24 38.9z" fill="#5a5568" stroke="#39354a" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M22.4 28.6h1.5L24 34.4z" fill="#7d7789" />
      </>
    );
  })(),

  // Lv.10 — tiger: forehead stripes, white muzzle, whiskers.
  tora: (() => {
    const t = TONES.tora;
    return (
      <>
        <Ink line={t.line}>
          <path d="M11.8 19.4 13.4 9.6 21.4 16z" fill={t.shade} />
          <path d="M36.2 19.4 34.6 9.6 26.6 16z" fill={t.shade} />
        </Ink>
        <path d="M13 18.6 14 11.6l5.8 4.8z" fill={t.base} />
        <path d="M35 18.6 34 11.6l-5.8 4.8z" fill={t.base} />
        <path d="M15 17.4 15.8 12.8 19 15.6z" fill="#463629" />
        <path d="M33 17.4 32.2 12.8 29 15.6z" fill="#463629" />
        <Head cy={27} rx={13.4} ry={12.2} tones={t} />
        <HeadLine cy={27} rx={13.4} ry={12.2} line={t.line} />
        <path d="M24 16.4v4.2M19.4 17.4l-1.5 3.5M28.6 17.4l1.5 3.5" stroke="#463629" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="24.3" cy="31.9" rx="8.7" ry="6.7" fill="#e9e0ec" />
        <ellipse cx="23.7" cy="31.2" rx="7.7" ry="5.9" fill="#fdfafd" />
        <Eyes y={25} dx={4.6} />
        <path d="M22.1 29.6h3.8L24 31.8z" fill={PUPIL} />
        <path d="M24 31.8v1.6M24 33.4q-2.5 1.8-4.2 0M24 33.4q2.5 1.8 4.2 0" stroke={PUPIL} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M15.4 30.4 9.8 29M15.4 33.6 9.8 33.8M32.6 30.4 38.2 29M32.6 33.6 38.2 33.8" stroke={PUPIL} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
      </>
    );
  })(),

  // Lv.15 — guardian lion: mane ring, fangs.
  shishi: (() => {
    const t = TONES.shishi;
    return (
      <>
        <Ink line={t.line}>
          <circle cx="24" cy="10.6" r="3.7" fill={t.shade} />
          <circle cx="10.6" cy="18.6" r="3.7" fill={t.shade} />
          <circle cx="37.4" cy="18.6" r="3.7" fill={t.shade} />
          <circle cx="10.6" cy="33.4" r="3.7" fill={t.shade} />
          <circle cx="37.4" cy="33.4" r="3.7" fill={t.shade} />
          <circle cx="24" cy="41.4" r="3.7" fill={t.shade} />
        </Ink>
        <Head cy={26} rx={16.4} ry={16.4} tones={t} rim={false} />
        <HeadLine cy={26} rx={16.4} ry={16.4} line={t.line} />
        <ellipse cx="24.4" cy="27.4" rx="11" ry="11" fill="#e09a58" />
        <ellipse cx="23.7" cy="26.6" rx="10" ry="10" fill="#f5b673" />
        <ellipse cx="19.4" cy="21.4" rx="3.6" ry="2.3" fill="#fff" opacity="0.3" transform="rotate(-28 19.4 21.4)" />
        <path d="M18.4 22.4q3-2.2 5.4 0M29.6 22.4q-3-2.2-5.4 0" stroke="#8a5320" strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <circle cx="19.6" cy="25.4" r="1.6" fill={PUPIL} />
        <circle cx="28.4" cy="25.4" r="1.6" fill={PUPIL} />
        <circle cx="20.2" cy="24.8" r="0.55" fill="#fff" />
        <circle cx="29" cy="24.8" r="0.55" fill="#fff" />
        <path d="M20.9 28.8h6.2L24 31.6z" fill="#8a3520" />
        <path d="M19.4 33q4.6 3.6 9.2 0" stroke="#8a3520" strokeWidth="1.9" strokeLinecap="round" fill="none" />
        <path d="M20.9 33.8l1.3 2.5M27.1 33.8l-1.3 2.5" stroke="#fdfafd" strokeWidth="1.9" strokeLinecap="round" />
      </>
    );
  })(),

  // Lv.20 — tengu: the long nose spikes past the chin, under a flat black tokin.
  tengu: (() => {
    const t = TONES.tengu;
    return (
      <>
        <Ink line="#241f33">
          <path d="M17.2 10.4h13.6l-1.5 4H18.7z" fill="#3a3550" />
        </Ink>
        <path d="M18.1 11.1h11.8l-.5 1.4H18.4z" fill="#544e70" />
        <Head cy={27} rx={12.6} ry={11.6} tones={t} />
        <HeadLine cy={27} rx={12.6} ry={11.6} line={t.line} />
        {/* Short and thick: a long thin nose reads as a pear stem. */}
        <path d="M21.9 27h4.2L24 39.6z" fill={t.shade} stroke={t.line} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M22.5 27.4h1.3L24 35z" fill="#ef6b58" />
        <path d="M16.4 21.8q3.2-2.4 5.4-.4M31.6 21.8q-3.2-2.4-5.4-.4" stroke="#fdfafd" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="18.6" cy="25.6" r="2" fill={PUPIL} />
        <circle cx="29.4" cy="25.6" r="2" fill={PUPIL} />
        <circle cx="19.3" cy="24.9" r="0.66" fill="#fff" />
        <circle cx="30.1" cy="24.9" r="0.66" fill="#fff" />
        <path d="M18.2 33.4q2.2 1.6 3.6 1.6M29.8 33.4q-2.2 1.6-3.6 1.6" stroke={t.line} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    );
  })(),

  // Lv.30 — phoenix: vermilion head with a five-tongue flame crest.
  hoo: (() => {
    const t = TONES.hoo;
    return (
      <>
        <Ink line={t.line}>
          {/* Five crest tongues, no side wings — flat wing sweeps stuck out at the
              temples and read as ears or paper planes. */}
          <path d="M24 3.2q3.2 6.6-1 11.8-4-5.2 1-11.8z" fill="#eab52a" />
          <path d="M16.4 5.6q5.6 4.6 3.6 10.8Q13 13.2 16.4 5.6z" fill="#e6465f" />
          <path d="M31.6 5.6q-5.6 4.6-3.6 10.8Q35 13.2 31.6 5.6z" fill="#e6465f" />
          <path d="M9.8 11.6q6.2 3.4 6.2 9.4Q9 18.6 9.8 11.6z" fill="#eab52a" />
          <path d="M38.2 11.6q-6.2 3.4-6.2 9.4Q39 18.6 38.2 11.6z" fill="#eab52a" />
        </Ink>
        <Head cy={27.6} rx={11.8} ry={11.8} tones={t} rim={false} />
        <HeadLine cy={27.6} rx={11.8} ry={11.8} line={t.line} />
        <ellipse cx="24.4" cy="29.6" rx="7.9" ry="8.1" fill="#e39d1e" />
        <ellipse cx="23.7" cy="28.9" rx="7" ry="7.2" fill="#f8bd45" />
        <ellipse cx="20.4" cy="25.2" rx="2.6" ry="1.7" fill="#fff" opacity="0.34" transform="rotate(-28 20.4 25.2)" />
        <circle cx="20.6" cy="27" r="2.05" fill={PUPIL} />
        <circle cx="27.4" cy="27" r="2.05" fill={PUPIL} />
        <circle cx="21.3" cy="26.2" r="0.68" fill="#fff" />
        <circle cx="28.1" cy="26.2" r="0.68" fill="#fff" />
        <path d="M21.3 31h5.4L24 38.2z" fill="#ffd35a" stroke="#a3700f" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M21.9 32.4h4.2L24 34.8z" fill="#e08a10" />
      </>
    );
  })(),

  // Lv.50 — dragon: gold horns, brow ridges, small snout with real nostrils and
  // two fangs. Eyes stay on the head grid so the snout cannot be misread as one.
  ryu: (() => {
    const t = TONES.ryu;
    return (
      <>
        <Ink line="#a3700f">
          <path d="M14.4 15.2 9.6 5.6l10 5.8z" fill="#eab52a" />
          <path d="M33.6 15.2 38.4 5.6l-10 5.8z" fill="#eab52a" />
        </Ink>
        <path d="M14.6 13.6 11.6 7.6l6.2 3.6z" fill="#fbd868" />
        <path d="M33.4 13.6 36.4 7.6l-6.2 3.6z" fill="#fbd868" />
        <Head cy={26.5} rx={13} ry={12.2} tones={t} />
        <HeadLine cy={26.5} rx={13} ry={12.2} line={t.line} />
        <path d="M16.4 20.6q3.6-2.4 6.2 0M31.6 20.6q-3.6-2.4-6.2 0" stroke="#0f6b4b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="19" cy="25" r="3.2" fill="#fdfafd" stroke="#0f6b4b" strokeWidth="1.2" />
        <circle cx="29" cy="25" r="3.2" fill="#fdfafd" stroke="#0f6b4b" strokeWidth="1.2" />
        <circle cx="19.3" cy="25.3" r="1.8" fill={PUPIL} />
        <circle cx="28.7" cy="25.3" r="1.8" fill={PUPIL} />
        <circle cx="19.95" cy="24.6" r="0.62" fill="#fff" />
        <circle cx="29.35" cy="24.6" r="0.62" fill="#fff" />
        <ellipse cx="24.3" cy="33.8" rx="5.9" ry="4.5" fill="#4fc295" stroke="#0f6b4b" strokeWidth="1.3" />
        <ellipse cx="23.6" cy="33" rx="4.9" ry="3.6" fill="#7cdcb2" />
        <circle cx="22.2" cy="32" r="0.95" fill="#0f6b4b" />
        <circle cx="25.8" cy="32" r="0.95" fill="#0f6b4b" />
        <path d="M20.8 35.4h6.4" stroke="#0f6b4b" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M21.6 35.9l-.7 2.3M26.4 35.9l.7 2.3" stroke="#fdfafd" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17.4 32.2q-4.8.4-6.8-3.2M30.6 32.2q4.8.4 6.8-3.2" stroke="#eab52a" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      </>
    );
  })(),
};

/**
 * The vector drawing, bypassing the raster manifest. `Mascot` is the component
 * to use in the app; this one exists because the artwork under public/mascots/
 * is rendered FROM these vectors (scripts/gen-mascot-refs.mjs), and going
 * through `Mascot` there would hand back last run's raster instead.
 */
export function MascotVector({
  slug,
  size = 40,
  className,
}: {
  slug: MascotSlug;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {ART[slug]}
    </svg>
  );
}

export function Mascot({
  slug,
  size = 40,
  className,
}: {
  slug: MascotSlug;
  size?: number;
  className?: string;
}) {
  const art = MASCOT_ART[slug];
  if (art && size >= MIN_RASTER_SIZE) {
    return (
      <Image
        src={art}
        alt=""
        width={size}
        height={size}
        quality={80}
        className={cn("shrink-0 object-contain", className)}
        aria-hidden="true"
      />
    );
  }

  return <MascotVector slug={slug} size={size} className={className} />;
}

/**
 * Mascot on its palette halo. `dimmed` greys out milestones not yet reached, so
 * the roadmap shows what is still ahead without hiding it.
 */
export function MascotBadge({
  slug,
  accent,
  size = 44,
  dimmed = false,
  className,
}: {
  slug: MascotSlug;
  accent: string;
  size?: number;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-all",
        dimmed && "opacity-50 saturate-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${accent} 30%, transparent), color-mix(in srgb, ${accent} 10%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 38%, transparent)`,
      }}
    >
      <Mascot slug={slug} size={Math.round(size * 0.84)} />
    </span>
  );
}

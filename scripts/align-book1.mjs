// Accurate forced alignment for book1 lessons.
//
// Whisper (base, --word_timestamps) gives recognized WORDS with precise times.
// We convert both the known sentence text and each Whisper word to katakana
// readings (kuromoji) so kanji/kana differences don't matter, then align the
// two reading-character streams with Needleman–Wunsch. Each sentence boundary
// maps to the real Whisper word time at that point — no proportional guessing,
// no rounding. Writes exact audio_start/audio_end to the DB.
//
// Prereq: whisper JSONs (with words) in resources/generated/whisper-book1/.
// Run: node scripts/align-book1.mjs   (DRY=1 to preview without DB writes)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const UNITS = process.env.UNITS
  ? process.env.UNITS.split(",").map((n) => Number(n.trim()))
  : [18, 19, 20];
const lessonId = (no) => `00000000-0000-0000-${String(no).padStart(4, "0")}-000000000000`;

// ---- kuromoji reading ----
let tokenizer = null;
async function getTokenizer() {
  if (tokenizer) return tokenizer;
  const { default: kuromoji } = await import("kuromoji");
  const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
  tokenizer = await new Promise((res, rej) =>
    kuromoji.builder({ dicPath }).build((e, t) => (e ? rej(e) : res(t))),
  );
  return tokenizer;
}
const toKatakana = (s) => s.replace(/[ぁ-ゖ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
// Reading in katakana; keep kanji for unknown words so both streams still match.
function reading(text) {
  const toks = tokenizer.tokenize(text);
  const r = toks.map((t) => (t.reading && t.reading !== "*" ? t.reading : t.surface_form)).join("");
  return toKatakana(r).replace(/[\s　、。！？!?「」『』（）()・･…‥,.\-ー]/gu, "");
}

// ---- sentence split (must match seed-book1.mjs / DB order) ----
function splitSentences(text) {
  const out = [];
  let cur = "";
  let depth = 0;
  for (const ch of text) {
    cur += ch;
    if (ch === "「" || ch === "『" || ch === "（" || ch === "(") depth++;
    else if (ch === "」" || ch === "』" || ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
    else if ((ch === "。" || ch === "！" || ch === "？") && depth === 0) {
      const s = cur.trim();
      if (s) out.push(s);
      cur = "";
    }
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}
const speakerRe = /^([^\s：:]{1,8})[：:]\s*(.+)$/;
function parseSentences(no) {
  const raw = readFileSync(path.join("resources", "book1", `${no}.md`), "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sentences = [];
  for (const line of lines.slice(1)) {
    const m = line.match(speakerRe);
    const body = m ? m[2] : line;
    for (const s of splitSentences(body)) sentences.push(s);
  }
  return sentences;
}

// Needleman–Wunsch: for each char in A return the aligned index in B (-1 if gap).
function nwMap(A, B) {
  const n = A.length;
  const m = B.length;
  const GAP = -1;
  const MATCH = 2;
  const MIS = -1;
  // score matrix (n+1)x(m+1)
  const score = new Int32Array((n + 1) * (m + 1));
  const idx = (i, j) => i * (m + 1) + j;
  for (let i = 0; i <= n; i++) score[idx(i, 0)] = i * GAP;
  for (let j = 0; j <= m; j++) score[idx(0, j)] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS);
      const up = score[idx(i - 1, j)] + GAP;
      const left = score[idx(i, j - 1)] + GAP;
      score[idx(i, j)] = Math.max(diag, up, left);
    }
  }
  const mapA = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const cur = score[idx(i, j)];
    if (cur === score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS)) {
      mapA[i - 1] = j - 1;
      i--;
      j--;
    } else if (cur === score[idx(i - 1, j)] + GAP) {
      i--; // A char is a gap (deletion)
    } else {
      j--; // B char is a gap (insertion)
    }
  }
  return mapA;
}

async function buildLesson(no) {
  const whisper = JSON.parse(
    readFileSync(path.join("resources", "generated", "whisper-book1", `book1-${no}.json`), "utf8"),
  );
  const words = whisper.segments.flatMap((s) => s.words ?? []);

  // Build B: per-reading-char timeline from words (interpolate time within word).
  const Bchars = [];
  const BtStart = [];
  const BtEnd = [];
  for (const w of words) {
    const r = reading(w.word ?? "");
    if (!r) continue;
    const L = r.length;
    for (let k = 0; k < L; k++) {
      Bchars.push(r[k]);
      BtStart.push(w.start + (k / L) * (w.end - w.start));
      BtEnd.push(w.start + ((k + 1) / L) * (w.end - w.start));
    }
  }

  // Build A: per-reading-char stream tagged with sentence index.
  const sentences = parseSentences(no);
  const Achars = [];
  const Asent = [];
  sentences.forEach((s, si) => {
    for (const ch of reading(s)) {
      Achars.push(ch);
      Asent.push(si);
    }
  });

  const mapA = nwMap(Achars, Bchars);
  // Forward/backward fill unmatched A chars with nearest B index (monotonic).
  for (let k = 1; k < mapA.length; k++) if (mapA[k] === -1) mapA[k] = mapA[k - 1];
  for (let k = mapA.length - 2; k >= 0; k--) if (mapA[k] === -1) mapA[k] = mapA[k + 1];

  const lastB = Bchars.length - 1;
  const spans = sentences.map((_, si) => {
    const first = Asent.indexOf(si);
    let last = Asent.lastIndexOf(si);
    const bFirst = Math.max(0, Math.min(lastB, mapA[first] ?? 0));
    const bLast = Math.max(0, Math.min(lastB, mapA[last] ?? lastB));
    let start = BtStart[bFirst];
    let end = BtEnd[bLast];
    if (!(end > start)) end = start + 0.3;
    return { start, end };
  });
  // Enforce monotonic, non-overlapping starts.
  for (let k = 1; k < spans.length; k++) {
    if (spans[k].start < spans[k - 1].end) spans[k].start = spans[k - 1].end;
    if (spans[k].end <= spans[k].start) spans[k].end = spans[k].start + 0.3;
  }
  return { no, sentences, spans };
}

await getTokenizer();
const results = [];
for (const no of UNITS) results.push(await buildLesson(no));

if (process.env.DRY) {
  for (const r of results) {
    console.log(`\n=== bài ${r.no} (${r.sentences.length} câu) ===`);
    r.sentences.forEach((s, i) =>
      console.log(`${String(i + 1).padStart(2)}. ${r.spans[i].start.toFixed(2)}s–${r.spans[i].end.toFixed(2)}s  ${s.slice(0, 30)}`),
    );
  }
  process.exit(0);
}

// ---- DB update (store exact values, no rounding) ----
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const rx = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
const ui = rx[1];
const ci = ui.indexOf(":");
const [host, port] = rx[2].split(":");
const client = new pg.Client({
  user: ui.slice(0, ci),
  password: ui.slice(ci + 1),
  host,
  port: Number(port) || 5432,
  database: rx[3],
  ssl: { rejectUnauthorized: false },
});
await client.connect();
console.log("connected to", host);
try {
  for (const r of results) {
    let n = 0;
    for (let i = 0; i < r.spans.length; i++) {
      const res = await client.query(
        `update public.lesson_sentences set audio_start=$1, audio_end=$2
         where lesson_id=$3 and order_index=$4`,
        [r.spans[i].start, r.spans[i].end, lessonId(r.no), i],
      );
      n += res.rowCount;
    }
    console.log(`bài ${r.no}: cập nhật ${n}/${r.spans.length} câu`);
  }
} finally {
  await client.end();
}

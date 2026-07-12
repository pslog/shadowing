// Re-align the 15 main-course lessons to the book1 model: precise per-sentence
// timestamps on the FULL lesson audio (no per-sentence clip files).
// Whisper (base, --word_timestamps) → kuromoji reading NW alignment. Reads
// sentences from the DB; writes audio_start/audio_end, clears audio_url, and
// points media_url at the local full-lesson file.
// Prereq: whisper JSONs in resources/generated/whisper-main/lesson-NN.json.
// Run: node scripts/align-main.mjs   (UNITS="1,2,3" to limit; DRY=1 to preview)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const UNITS = process.env.UNITS
  ? process.env.UNITS.split(",").map((n) => Number(n.trim()))
  : Array.from({ length: 15 }, (_, i) => i + 1);
const key = (n) => String(n).padStart(2, "0");
const lessonId = (n) => `00000000-0000-0000-0000-0000000b${String(n).padStart(4, "0")}`;
const mediaUrl = (n) => `/audio/lessons/lesson-${key(n)}.m4a`;

// ---- kuromoji reading ----
let tokenizer;
async function getTokenizer() {
  const { default: kuromoji } = await import("kuromoji");
  const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
  tokenizer = await new Promise((res, rej) =>
    kuromoji.builder({ dicPath }).build((e, t) => (e ? rej(e) : res(t))),
  );
}
const toKatakana = (s) => s.replace(/[ぁ-ゖ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
function reading(text) {
  const r = tokenizer
    .tokenize(text)
    .map((t) => (t.reading && t.reading !== "*" ? t.reading : t.surface_form))
    .join("");
  return toKatakana(r).replace(/[\s　、。！？!?「」『』（）()・･…‥,.\-ー]/gu, "");
}

// ---- Needleman–Wunsch (same as align-book1) ----
function nwMap(A, B) {
  const n = A.length, m = B.length, GAP = -1, MATCH = 2, MIS = -1;
  const score = new Int32Array((n + 1) * (m + 1));
  const idx = (i, j) => i * (m + 1) + j;
  for (let i = 0; i <= n; i++) score[idx(i, 0)] = i * GAP;
  for (let j = 0; j <= m; j++) score[idx(0, j)] = j * GAP;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      score[idx(i, j)] = Math.max(
        score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS),
        score[idx(i - 1, j)] + GAP,
        score[idx(i, j - 1)] + GAP,
      );
  const mapA = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const cur = score[idx(i, j)];
    if (cur === score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS)) { mapA[i - 1] = j - 1; i--; j--; }
    else if (cur === score[idx(i - 1, j)] + GAP) i--;
    else j--;
  }
  return mapA;
}

function align(sentences, words) {
  const Bchars = [], BtStart = [], BtEnd = [];
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
  const Achars = [], Asent = [];
  sentences.forEach((s, si) => { for (const ch of reading(s)) { Achars.push(ch); Asent.push(si); } });
  const mapA = nwMap(Achars, Bchars);
  for (let k = 1; k < mapA.length; k++) if (mapA[k] === -1) mapA[k] = mapA[k - 1];
  for (let k = mapA.length - 2; k >= 0; k--) if (mapA[k] === -1) mapA[k] = mapA[k + 1];
  const lastB = Bchars.length - 1;
  const spans = sentences.map((_, si) => {
    const first = Asent.indexOf(si), last = Asent.lastIndexOf(si);
    const bFirst = Math.max(0, Math.min(lastB, mapA[first] ?? 0));
    const bLast = Math.max(0, Math.min(lastB, mapA[last] ?? lastB));
    let start = BtStart[bFirst], end = BtEnd[bLast];
    if (!(end > start)) end = start + 0.3;
    return { start, end };
  });
  for (let k = 1; k < spans.length; k++) {
    if (spans[k].start < spans[k - 1].end) spans[k].start = spans[k - 1].end;
    if (spans[k].end <= spans[k].start) spans[k].end = spans[k].start + 0.3;
  }
  return spans;
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const rx = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
const ui = rx[1], ci = ui.indexOf(":"), [host, port] = rx[2].split(":");
const client = new pg.Client({
  user: ui.slice(0, ci), password: ui.slice(ci + 1), host, port: Number(port) || 5432,
  database: rx[3], ssl: { rejectUnauthorized: false },
});

await getTokenizer();
await client.connect();
console.log("connected to", host);
try {
  for (const n of UNITS) {
    const whisper = JSON.parse(
      readFileSync(path.join("resources", "generated", "whisper-main", `lesson-${key(n)}.json`), "utf8"),
    );
    const words = whisper.segments.flatMap((s) => s.words ?? []);
    const rows = (await client.query(
      "select order_index, ja_text from public.lesson_sentences where lesson_id=$1 order by order_index",
      [lessonId(n)],
    )).rows;
    if (rows.length === 0) { console.log(`bài ${n}: 0 câu, bỏ qua`); continue; }
    const spans = align(rows.map((r) => r.ja_text), words);

    if (process.env.DRY) {
      console.log(`\n=== 第${n}課 (${rows.length} câu) ===`);
      rows.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${spans[i].start.toFixed(2)}–${spans[i].end.toFixed(2)}s  ${r.ja_text.slice(0, 26)}`));
      continue;
    }
    for (let i = 0; i < rows.length; i++) {
      await client.query(
        "update public.lesson_sentences set audio_start=$1, audio_end=$2, audio_url=null where lesson_id=$3 and order_index=$4",
        [spans[i].start, spans[i].end, lessonId(n), rows[i].order_index],
      );
    }
    await client.query("update public.lessons set media_url=$1 where id=$2", [mediaUrl(n), lessonId(n)]);
    console.log(`第${n}課: ${rows.length} câu, audio_url xoá, media_url=${mediaUrl(n)}`);
  }
} finally {
  await client.end();
}

// Seed one JLPT N2 listening exam: each question (番) → 1 lesson (shadowing the
// dialogue only). Aligns the OCR'd script to the exam audio via Whisper word
// timestamps + kuromoji-reading NW, cuts a per-question audio segment, and
// upserts lessons/sentences into the matching 問題 course.
//
// Env: EXAM=2010-07  MONDAI=1  WHISPER=<path to whisper json>  [DRY=1]
// The whisper json must cover the audio region containing this 問題 (timestamps
// are absolute from the start of the source audio, i.e. the extract starts at 0).
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

const EXAM = process.env.EXAM || "2010-07";
const MONDAI = Number(process.env.MONDAI || "1");
const WHISPER = process.env.WHISPER;
if (!WHISPER) throw new Error("set WHISPER=<whisper json path>");

const exam = JSON.parse(readFileSync(path.join("resources", "n2", "exams", `${EXAM}.json`), "utf8"));
const mondai = exam.mondai.find((m) => m.no === MONDAI);
if (!mondai) throw new Error(`mondai ${MONDAI} not in ${EXAM}.json`);
const examCode = EXAM.replace(/-/g, "").padEnd(8, "0").slice(0, 8); // 8-hex uuid group
const lessonId = (m, q) => `${examCode}-000${m}-0000-0000-${String(q).padStart(12, "0")}`;
const outDir = path.join("public", "audio", "n2", EXAM);
const mediaUrl = (m, q) => `/audio/n2/${EXAM}/m${m}-q${q}.mp3`;

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
  const r = tokenizer.tokenize(text)
    .map((t) => (t.reading && t.reading !== "*" ? t.reading : t.surface_form)).join("");
  return toKatakana(r).replace(/[\s　、。！？!?「」『』（）()・･…‥,.\-ー]/gu, "");
}
function splitSentences(text) {
  const out = []; let cur = ""; let depth = 0;
  for (const ch of text) {
    cur += ch;
    if ("「『（(".includes(ch)) depth++;
    else if ("」』）)".includes(ch)) depth = Math.max(0, depth - 1);
    else if ("。！？".includes(ch) && depth === 0) { const s = cur.trim(); if (s) out.push(s); cur = ""; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
}

// ---- NW (same as align-main) ----
function nwMap(A, B) {
  const n = A.length, m = B.length, GAP = -1, MATCH = 2, MIS = -1;
  const score = new Int32Array((n + 1) * (m + 1));
  const idx = (i, j) => i * (m + 1) + j;
  for (let i = 0; i <= n; i++) score[idx(i, 0)] = i * GAP;
  for (let j = 0; j <= m; j++) score[idx(0, j)] = j * GAP;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    score[idx(i, j)] = Math.max(
      score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS),
      score[idx(i - 1, j)] + GAP, score[idx(i, j - 1)] + GAP);
  const mapA = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const cur = score[idx(i, j)];
    if (cur === score[idx(i - 1, j - 1)] + (A[i - 1] === B[j - 1] ? MATCH : MIS)) { mapA[i - 1] = j - 1; i--; j--; }
    else if (cur === score[idx(i - 1, j)] + GAP) i--; else j--;
  }
  return mapA;
}
function alignSpans(sentences, words) {
  const Bc = [], Bs = [], Be = [];
  for (const w of words) {
    const r = reading(w.word ?? ""); if (!r) continue;
    for (let k = 0; k < r.length; k++) { Bc.push(r[k]); Bs.push(w.start + (k / r.length) * (w.end - w.start)); Be.push(w.start + ((k + 1) / r.length) * (w.end - w.start)); }
  }
  const Ac = [], As = [];
  sentences.forEach((s, si) => { for (const ch of reading(s)) { Ac.push(ch); As.push(si); } });
  const mapA = nwMap(Ac, Bc);
  for (let k = 1; k < mapA.length; k++) if (mapA[k] === -1) mapA[k] = mapA[k - 1];
  for (let k = mapA.length - 2; k >= 0; k--) if (mapA[k] === -1) mapA[k] = mapA[k + 1];
  const lastB = Bc.length - 1;
  const spans = sentences.map((s, si) => {
    const f = As.indexOf(si), l = As.lastIndexOf(si);
    const bf = Math.max(0, Math.min(lastB, mapA[f] ?? 0)), bl = Math.max(0, Math.min(lastB, mapA[l] ?? lastB));
    let start = Bs[bf], end = Be[bl]; if (!(end > start)) end = start + 0.3;
    // Clamp implausibly long spans (a short line absorbing intro/example gaps):
    // cap duration to a reading-length budget, trimming from the start.
    const maxDur = Math.max(2.5, reading(s).length * 0.35 + 1.5);
    if (end - start > maxDur) start = end - maxDur;
    return { start, end };
  });
  for (let k = 1; k < spans.length; k++) { if (spans[k].start < spans[k - 1].end) spans[k].start = spans[k - 1].end; if (spans[k].end <= spans[k].start) spans[k].end = spans[k].start + 0.3; }
  return spans;
}

// Per question: alignment items = setup + dialogue + toi. Only 'dia' items are
// seeded as shadowing sentences; 'anchor' (setup/toi) items just pin boundaries.
function buildQuestions() {
  return mondai.questions.map((q) => {
    const items = [];
    if (q.setup) for (const s of splitSentences(q.setup)) items.push({ kind: "anchor", ja: s });
    for (const line of q.lines) for (const s of splitSentences(line.ja)) items.push({ kind: "dia", sp: line.sp, ja: s });
    if (q.toi) for (const s of splitSentences(q.toi)) items.push({ kind: "anchor", ja: s });
    return { num: q.num, theme: q.theme, items };
  });
}

await getTokenizer();
// Whisper json may cover a sub-window of the source; WHISPER_OFFSET shifts its
// timestamps back to absolute source time (for cutting from the full audio).
const OFFSET = Number(process.env.WHISPER_OFFSET || 0);
const whisper = JSON.parse(readFileSync(WHISPER, "utf8"));
const words = whisper.segments
  .flatMap((s) => s.words ?? [])
  .map((w) => ({ word: w.word, start: w.start + OFFSET, end: w.end + OFFSET }));
const questions = buildQuestions();
const flat = questions.flatMap((q) => q.items.map((it) => it.ja));
const spans = alignSpans(flat, words);
let ci0 = 0;
for (const q of questions) for (const it of q.items) it.span = spans[ci0++];
// dialogue-only view per question
for (const q of questions) {
  q.dia = q.items.filter((it) => it.kind === "dia");
  q.segStart = Math.max(0, q.dia[0].span.start - 0.25);
  q.segEnd = q.dia[q.dia.length - 1].span.end + 0.25;
}

if (process.env.DRY) {
  for (const q of questions) {
    console.log(`\n=== 問題${MONDAI}-${q.num} ${q.theme}  [${q.segStart.toFixed(1)}–${q.segEnd.toFixed(1)}s]  (${q.dia.length} câu) ===`);
    q.dia.forEach((s) => console.log(`  ${s.span.start.toFixed(1)}-${s.span.end.toFixed(1)}  [${s.sp}] ${s.ja.slice(0, 30)}`));
  }
  process.exit(0);
}

// ffmpeg cut
function cut(src, out, start, end) {
  mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", src, "-c:a", "libmp3lame", "-b:a", "128k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg: " + r.stderr);
}

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const rx = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
const ui = rx[1], ci2 = ui.indexOf(":"), [host, port] = rx[2].split(":");
const client = new pg.Client({ user: ui.slice(0, ci2), password: ui.slice(ci2 + 1), host, port: Number(port) || 5432, database: rx[3], ssl: { rejectUnauthorized: false } });

await client.connect();
console.log("connected to", host);
try {
  for (const q of questions) {
    cut(exam.sourceAudio, path.join(outDir, `m${MONDAI}-q${q.num}.mp3`), q.segStart, q.segEnd);

    const lid = lessonId(MONDAI, q.num);
    const title = `${exam.examLabel} 問題${MONDAI}-${q.num} ${q.theme}`;
    await client.query(
      `insert into public.lessons (id,user_id,course_id,title,topic,level,source_type,media_url,is_public)
       values ($1,null,$2,$3,'聴解','N2','upload',$4,true)
       on conflict (id) do update set course_id=excluded.course_id, title=excluded.title, media_url=excluded.media_url, is_public=excluded.is_public`,
      [lid, mondai.courseId, title, mediaUrl(MONDAI, q.num)],
    );
    await client.query("delete from public.lesson_sentences where lesson_id=$1", [lid]);
    for (let i = 0; i < q.dia.length; i++) {
      const s = q.dia[i];
      const sid = `${examCode}-000${MONDAI}-0000-${String(q.num).padStart(4, "0")}-${String(i + 1).padStart(12, "0")}`;
      await client.query(
        `insert into public.lesson_sentences (id,lesson_id,order_index,ja_text,vi_translation,audio_start,audio_end,pass_score)
         values ($1,$2,$3,$4,$5,$6,$7,80)`,
        [sid, lid, i, s.ja, s.sp, s.span.start - q.segStart, s.span.end - q.segStart],
      );
    }
    console.log(`問題${MONDAI}-${q.num}: ${q.dia.length} câu, seg ${q.segStart.toFixed(1)}-${q.segEnd.toFixed(1)}s → ${mediaUrl(MONDAI, q.num)}`);
  }
} finally {
  await client.end();
}

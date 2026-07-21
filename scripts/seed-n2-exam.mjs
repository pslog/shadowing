// Seed one JLPT N2 listening exam: each question (番) → 1 lesson (shadowing the
// dialogue only). Aligns the script to the exam audio via Whisper word
// timestamps + kuromoji-reading alignment, cuts a per-question audio segment,
// and upserts lessons/sentences into the matching 問題 course.
//
// ── FULL PIPELINE to add a new exam ──────────────────────────────────────────
//   1. Add resources/n2/exams/<EXAM>.json (fields: exam, examLabel, sourceAudio,
//      mondai[{no,courseId,questions[{num,theme,setup,toi,lines[{sp,ja}]}]}]).
//   2. Transcribe the WHOLE source with VAD OFF (VAD drops quiet onsets and
//      cuts the first word — this was the root of the "mất/thừa đầu câu" bug):
//        python scripts/fw-window.py "<sourceAudio>" 0 <durSec> \
//          resources/generated/n2-whisper/<EXAM>-full.json base
//      (or add the exam to scripts/fw-all-n2.py and run it).
//   3. Seed the whole exam in one pass (MONDAI defaults to "all" — needed so the
//      forward cursor stays monotonic across every 問題):
//        EXAM=<EXAM> WHISPER=resources/generated/n2-whisper/<EXAM>-full.json \
//          WHISPER_OFFSET=0 node scripts/seed-n2-exam.mjs        (add DRY=1 to preview)
//   4. Audit every clip's opening:
//        node scripts/n2-dump-check.mjs && python scripts/n2-check-clips.py
//      then read resources/generated/n2-whisper/check-report.json (offset>1.5s or
//      a head starting with "N番" = leading narration leaked).
//   5. 即時応答 (問題4, no setup/問い) sometimes keeps a ~1-2s "N番" announcement at
//      the front that no anchor can consume; trim those few directly: re-cut the
//      mp3 with `ffmpeg -ss <T>` and shift the lesson's timings by -T.
//
// How the alignment stays robust (see the loop below): dialogue-only Smith-
// Waterman locates each question's region; a forward cursor keeps questions in
// order; setup/問い are anchored on BOTH sides (問い is read before AND after the
// dialogue) so narration isn't swallowed by the first/last line; the clip starts
// 0.6s before the first line with a 0.4s pre-roll on sentence 0.
//
// Env: EXAM=2010-07  [MONDAI=all|<n>]  WHISPER=<path>  [WHISPER_OFFSET=0] [DRY=1]
//      [PUBLIC=1]  — lessons are is_public=false by default (admin publishes later);
//      set PUBLIC=1 to seed them public.
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

const EXAM = process.env.EXAM || "2010-07";
// MONDAI: a specific number, or "all" (default) to seed the whole exam in one
// pass — needed so the forward cursor stays monotonic across all 問題.
const MONDAI_ENV = process.env.MONDAI || "all";
const WHISPER = process.env.WHISPER;
if (!WHISPER) throw new Error("set WHISPER=<whisper json path>");
// New exams default to PRIVATE (admin reviews then publishes); PUBLIC=1 overrides.
const IS_PUBLIC = process.env.PUBLIC === "1" || process.env.PUBLIC === "true";

const exam = JSON.parse(readFileSync(path.join("resources", "n2", "exams", `${EXAM}.json`), "utf8"));
const mondaiNos =
  MONDAI_ENV === "all"
    ? exam.mondai.map((m) => m.no).sort((a, b) => a - b)
    : [Number(MONDAI_ENV)];
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
// Ruby furigana JSON: array of [surface] or [surface, hiraganaReading].
const kataToHira = (s) => s.replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasKanji = (s) => /[㐀-䶿一-龯々]/u.test(s);
function furigana(text) {
  return JSON.stringify(tokenizer.tokenize(text).map((t) => {
    const s = t.surface_form;
    if (hasKanji(s) && t.reading && t.reading !== "*") {
      const r = kataToHira(t.reading);
      if (r && r !== s) return [s, r];
    }
    return [s];
  }));
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

// Clip the (possibly whole-exam) word list down to this 問題's audio region
// before aligning, so global NW doesn't drift across the exam. Uses a
// Smith-Waterman local alignment of the mondai's reading against the full word
// char-stream to robustly find the matching region (tolerant of gaps/errors).
function swRegion(Qc, Rc) {
  const n = Qc.length, m = Rc.length;
  const MATCH = 2, MIS = -1, GAP = -2;
  let prev = new Int32Array(m + 1), prevOrig = new Int32Array(m + 1);
  let cur = new Int32Array(m + 1), curOrig = new Int32Array(m + 1);
  let best = 0, bestEnd = 0, bestStart = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = prev[j - 1] + (Qc[i - 1] === Rc[j - 1] ? MATCH : MIS);
      const up = prev[j] + GAP;
      const left = cur[j - 1] + GAP;
      let s = diag, orig = prevOrig[j - 1];
      if (up > s) { s = up; orig = prevOrig[j]; }
      if (left > s) { s = left; orig = curOrig[j - 1]; }
      if (s <= 0) { s = 0; orig = j; }
      cur[j] = s; curOrig[j] = orig;
      if (s > best) { best = s; bestEnd = j; bestStart = orig; }
    }
    [prev, cur] = [cur, prev];
    [prevOrig, curOrig] = [curOrig, prevOrig];
    cur.fill(0); curOrig.fill(0);
  }
  return { start: bestStart, end: bestEnd };
}
// Time bounds of the region best matching `sentences` (readings) within `words`.
function regionTimes(sentences, words) {
  const Rc = [], Rt = [];
  for (const w of words) {
    const r = reading(w.word ?? ""); if (!r) continue;
    for (let k = 0; k < r.length; k++) { Rc.push(r[k]); Rt.push(w.start); }
  }
  const Qc = sentences.map(reading).join("").split("");
  if (Qc.length < 20 || Rc.length < 60) return null;
  const { start, end } = swRegion(Qc, Rc);
  if (!(end > start)) return null;
  return { t0: Rt[Math.max(0, start - 1)], t1: Rt[Math.min(Rc.length - 1, end - 1)] };
}

// Items = setup(anchor) + dialogue + toi(anchor). Only 'dia' items are seeded;
// the anchors are aligned too so the setup/toi narration is consumed by them
// instead of being absorbed into the first/last dialogue line's audio.
function buildQuestions(mondai) {
  return mondai.questions.map((q) => {
    const items = [];
    if (q.setup) for (const s of splitSentences(q.setup)) items.push({ kind: "anchor", ja: s });
    // The 問い is read BEFORE the dialogue (and repeated after) in 課題/ポイント
    // 理解, so anchor it on both sides to consume both occurrences and keep the
    // first/last dialogue line from swallowing the narration.
    if (q.toi) for (const s of splitSentences(q.toi)) items.push({ kind: "anchor", ja: s });
    for (const line of q.lines) for (const s of splitSentences(line.ja)) items.push({ kind: "dia", sp: line.sp, ja: s });
    if (q.toi) for (const s of splitSentences(q.toi)) items.push({ kind: "anchor", ja: s });
    return { num: q.num, theme: q.theme, items, hasNarration: Boolean(q.setup || q.toi) };
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

// Align every question of the selected mondai IN EXAM ORDER with a single
// forward cursor: each question only searches words at/after the previous one's
// end, so a short/generic opening line can't drift back into earlier audio.
// SW-locate each question's region, NW-align inside it, then set the clip window
// (0.6s before the first line's onset → just after the last).
const jobs = [];
let cursor = 0;
for (const mno of mondaiNos) {
  const mondai = exam.mondai.find((m) => m.no === mno);
  if (!mondai) throw new Error(`mondai ${mno} not in ${EXAM}.json`);
  for (const q of buildQuestions(mondai)) {
    const diaItems = q.items.filter((it) => it.kind === "dia").map((it) => it.ja);
    const fwd = words.filter((w) => w.end >= cursor - 1);
    const src = fwd.length >= 20 ? fwd : words;
    // Locate the region from the DISTINCTIVE dialogue. When the question has
    // setup/問い narration, widen the window ~12s left so that narration is inside
    // it and gets consumed by the anchors. For 即時応答 (no narration) keep the
    // window tight so the "N番" announcement stays OUT and isn't swallowed by the
    // first line.
    const leftPad = q.hasNarration ? 12 : 1.2;
    const reg = regionTimes(diaItems, src);
    const win = reg
      ? src.filter((w) => w.end >= reg.t0 - leftPad && w.start <= reg.t1 + 4)
      : src;
    const qWords = win.length >= 10 ? win : src;
    const qItems = q.items.map((it) => it.ja);
    const qSpans = alignSpans(qItems, qWords);
    q.items.forEach((it, i) => (it.span = qSpans[i]));
    q.dia = q.items.filter((it) => it.kind === "dia");
    cursor = Math.max(cursor, q.dia[q.dia.length - 1].span.end);
    q.segStart = Math.max(0, q.dia[0].span.start - 0.4);
    // Generous tail pad: Whisper underestimates the last word's end, so +0.25
    // often clips the final phrase. +1.2 keeps it whole (trailing silence is fine).
    q.segEnd = q.dia[q.dia.length - 1].span.end + 1.2;
    jobs.push({ mno, courseId: mondai.courseId, q });
  }
}

if (process.env.DRY) {
  for (const { mno, q } of jobs) {
    console.log(`\n=== 問題${mno}-${q.num} ${q.theme}  [${q.segStart.toFixed(1)}–${q.segEnd.toFixed(1)}s]  (${q.dia.length} câu) ===`);
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
  for (const { mno, courseId, q } of jobs) {
    cut(exam.sourceAudio, path.join(outDir, `m${mno}-q${q.num}.mp3`), q.segStart, q.segEnd);

    const lid = lessonId(mno, q.num);
    const title = `${exam.examLabel} 問題${mno}-${q.num} ${q.theme}`;
    await client.query(
      `insert into public.lessons (id,user_id,course_id,title,topic,level,source_type,media_url,is_public)
       values ($1,null,$2,$3,'聴解','N2','upload',$4,$5)
       on conflict (id) do update set course_id=excluded.course_id, title=excluded.title, media_url=excluded.media_url, is_public=excluded.is_public`,
      [lid, courseId, title, mediaUrl(mno, q.num), IS_PUBLIC],
    );
    await client.query("delete from public.lesson_sentences where lesson_id=$1", [lid]);
    for (let i = 0; i < q.dia.length; i++) {
      const s = q.dia[i];
      const sid = `${examCode}-000${mno}-0000-${String(q.num).padStart(4, "0")}-${String(i + 1).padStart(12, "0")}`;
      // Sentence 0: start ~0.4s before its onset (small pre-roll) instead of the
      // raw span start — keeps the full onset without a long setup-gap silence.
      const rel = s.span.start - q.segStart;
      const audioStart = i === 0 ? Math.max(0, rel - 0.4) : rel;
      await client.query(
        `insert into public.lesson_sentences (id,lesson_id,order_index,ja_text,furigana,vi_translation,audio_start,audio_end,pass_score)
         values ($1,$2,$3,$4,$5,$6,$7,$8,80)`,
        [sid, lid, i, s.ja, furigana(s.ja), s.sp, audioStart, s.span.end - q.segStart],
      );
    }
    console.log(`問題${mno}-${q.num}: ${q.dia.length} câu, seg ${q.segStart.toFixed(1)}-${q.segEnd.toFixed(1)}s → ${mediaUrl(mno, q.num)}`);
  }
} finally {
  await client.end();
}

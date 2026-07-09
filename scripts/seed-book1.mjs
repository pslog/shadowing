// Seed the first 3 lessons (units 18-20) of the course
// "シャドーイング もっと話せる日本語 中～上級編" (…0c0005) from resources/book1.
// Splits each .md into shadowing sentences (quote-aware) and upserts lessons +
// sentences into Supabase. DRY=1 prints the split without touching the DB.
// Run: node scripts/seed-book1.mjs   (or DRY=1 node scripts/seed-book1.mjs)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const COURSE_ID = "00000000-0000-0000-0000-0000000c0005";
const UNITS = process.env.UNITS
  ? process.env.UNITS.split(",").map((n) => Number(n.trim()))
  : [18, 19, 20];

function lessonId(no) {
  return `00000000-0000-0000-${String(no).padStart(4, "0")}-000000000000`;
}
function sentenceId(no, idx) {
  return `00000000-0000-0000-${String(no).padStart(4, "0")}-${String(idx).padStart(12, "0")}`;
}

// Split Japanese text into sentences on 。！？ — but never inside 「」『』（）.
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

function parseLesson(no) {
  const raw = readFileSync(path.join("resources", "book1", `${no}.md`), "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines[0];
  const sentences = [];
  for (const line of lines.slice(1)) {
    const m = line.match(speakerRe);
    if (m) {
      const speaker = m[1];
      for (const s of splitSentences(m[2])) {
        sentences.push({ ja: s, note: speaker }); // note = who speaks
      }
    } else {
      for (const s of splitSentences(line)) sentences.push({ ja: s, note: null });
    }
  }
  return {
    id: lessonId(no),
    title,
    media_url: `/audio/lessons/book1-${no}.mp3`,
    sentences,
  };
}

const lessons = UNITS.map(parseLesson);

if (process.env.DRY) {
  for (const l of lessons) {
    console.log(`\n=== ${l.title}  (${l.sentences.length} sentences) ===`);
    l.sentences.forEach((s, i) =>
      console.log(`${String(i + 1).padStart(2)}. ${s.note ? `[${s.note}] ` : ""}${s.ja}`),
    );
  }
  process.exit(0);
}

// ---- DB ----
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
const userinfo = rx[1];
const ci = userinfo.indexOf(":");
const [host, port] = rx[2].split(":");
const client = new pg.Client({
  user: userinfo.slice(0, ci),
  password: userinfo.slice(ci + 1),
  host,
  port: Number(port) || 5432,
  database: rx[3],
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("connected to", host);
try {
  for (const l of lessons) {
    await client.query(
      `insert into public.lessons
         (id, user_id, course_id, title, topic, level, source_type, media_url, is_public)
       values ($1,null,$2,$3,'会話','N2-N1','upload',$4,true)
       on conflict (id) do update set
         course_id=excluded.course_id, title=excluded.title, media_url=excluded.media_url,
         is_public=excluded.is_public`,
      [l.id, COURSE_ID, l.title, l.media_url],
    );
    // Rebuild sentences for this lesson (idempotent; lessons are new -> no attempts).
    await client.query(`delete from public.lesson_sentences where lesson_id=$1`, [l.id]);
    for (let i = 0; i < l.sentences.length; i++) {
      const s = l.sentences[i];
      await client.query(
        `insert into public.lesson_sentences
           (id, lesson_id, order_index, ja_text, vi_translation, pass_score)
         values ($1,$2,$3,$4,$5,80)`,
        [sentenceId(UNITS[lessons.indexOf(l)], i + 1), l.id, i, s.ja, s.note],
      );
    }
    console.log(`ok: ${l.title} — ${l.sentences.length} sentences`);
  }
} finally {
  await client.end();
}

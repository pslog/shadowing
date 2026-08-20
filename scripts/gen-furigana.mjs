// Generate furigana (ruby) data for lesson sentences using kuromoji, and
// store it in lesson_sentences.furigana as JSON: an array of tokens where each
// token is [surface] (plain) or [surface, hiraganaReading] (kanji → ruby).
// Run: node scripts/gen-furigana.mjs
//      COURSE_SLUG=kanji-shiawase-dokuhon node scripts/gen-furigana.mjs
//      DRY=1 node scripts/gen-furigana.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const kataToHira = (s) =>
  s.replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasKanji = (s) => /[㐀-䶿一-龯々]/u.test(s);

let tokenizer;
async function getTokenizer() {
  const { default: kuromoji } = await import("kuromoji");
  const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
  tokenizer = await new Promise((res, rej) =>
    kuromoji.builder({ dicPath }).build((e, t) => (e ? rej(e) : res(t))),
  );
}

function furiganaFor(text) {
  return tokenizer.tokenize(text).map((t) => {
    const s = t.surface_form;
    if (hasKanji(s) && t.reading && t.reading !== "*") {
      const r = kataToHira(t.reading);
      if (r && r !== s) return [s, r];
    }
    return [s];
  });
}

await getTokenizer();

if (process.env.DRY) {
  for (const s of [
    "私はエンジニアです。",
    "今のラーメンに最も近いと考えられるものは、1910年頃、東京の浅草にできた「来々軒」。",
    "空弁？",
  ]) {
    console.log(s, "→", JSON.stringify(furiganaFor(s)));
  }
  process.exit(0);
}

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
  await client.query("alter table public.lesson_sentences add column if not exists furigana text");
  const courseSlug = process.env.COURSE_SLUG;
  const { rows } = courseSlug
    ? await client.query(
        `select ls.id, ls.ja_text
           from public.lesson_sentences ls
           join public.lessons l on l.id = ls.lesson_id
           join public.courses c on c.id = l.course_id
           where c.slug = $1
           order by l.id, ls.order_index`,
        [courseSlug],
      )
    : await client.query("select id, ja_text from public.lesson_sentences order by lesson_id, order_index");
  console.log("sentences:", rows.length);
  const batchSize = Number(process.env.BATCH_SIZE) || 200;
  let n = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuesSql = [];
    const params = [];

    batch.forEach((r, index) => {
      const base = index * 2;
      valuesSql.push(`($${base + 1}, $${base + 2})`);
      params.push(r.id, JSON.stringify(furiganaFor(r.ja_text)));
    });

    if (batch.length) {
      await client.query(
        `update public.lesson_sentences as ls
           set furigana = v.furigana
           from (values ${valuesSql.join(",")}) as v(id, furigana)
           where ls.id = v.id::uuid`,
        params,
      );
    }

    n += batch.length;
    console.log(`  ${n}/${rows.length}`);
  }
  console.log(`done: ${n} sentences updated`);
} finally {
  await client.end();
}

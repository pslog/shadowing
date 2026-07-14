// Generate URL-friendly slugs for courses and lessons (SEO + readable URLs).
// Romanizes Japanese titles via kuromoji readings + a katakana→romaji map,
// slugifies, ensures uniqueness, and writes to the `slug` columns.
// Course slugs use curated overrides for the known courses.
// Run: node scripts/gen-slugs.mjs   (DRY=1 to preview)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

// katakana → romaji (Hepburn-ish; good enough for slugs)
const COMBO = {
  キャ: "kya", キュ: "kyu", キョ: "kyo", シャ: "sha", シュ: "shu", ショ: "sho",
  チャ: "cha", チュ: "chu", チョ: "cho", ニャ: "nya", ニュ: "nyu", ニョ: "nyo",
  ヒャ: "hya", ヒュ: "hyu", ヒョ: "hyo", ミャ: "mya", ミュ: "myu", ミョ: "myo",
  リャ: "rya", リュ: "ryu", リョ: "ryo", ギャ: "gya", ギュ: "gyu", ギョ: "gyo",
  ジャ: "ja", ジュ: "ju", ジョ: "jo", ビャ: "bya", ビュ: "byu", ビョ: "byo",
  ピャ: "pya", ピュ: "pyu", ピョ: "pyo", ヴァ: "va", ヴィ: "vi", ヴェ: "ve", ヴォ: "vo",
  ファ: "fa", フィ: "fi", フェ: "fe", フォ: "fo", ティ: "ti", ディ: "di", ドゥ: "du",
  ウィ: "wi", ウェ: "we", ウォ: "wo", チェ: "che", ジェ: "je", シェ: "she",
};
const MONO = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
  パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヲ: "o", ン: "n", ヴ: "vu",
};
function romajiFromKatakana(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (COMBO[two]) { out += COMBO[two]; i++; continue; }
    const ch = s[i];
    if (ch === "ッ") { const n = MONO[s[i + 1]] || COMBO[s.slice(i + 1, i + 3)] || ""; out += n[0] || ""; continue; }
    if (ch === "ー") { out += out.slice(-1); continue; }
    if (MONO[ch]) { out += MONO[ch]; continue; }
    out += ch; // ascii / digit / unknown kept
  }
  return out;
}
const hiraToKata = (s) => s.replace(/[ぁ-ゖ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

let tokenizer;
async function getTokenizer() {
  const { default: kuromoji } = await import("kuromoji");
  const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
  tokenizer = await new Promise((res, rej) =>
    kuromoji.builder({ dicPath }).build((e, t) => (e ? rej(e) : res(t))),
  );
}
function slugify(title) {
  const reading = tokenizer
    .tokenize(title)
    .map((t) => (t.reading && t.reading !== "*" ? t.reading : hiraToKata(t.surface_form)))
    .join("");
  const romaji = romajiFromKatakana(reading);
  return romaji
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// Curated course slugs (nicer than auto-romaji).
const COURSE_SLUGS = {
  "00000000-0000-0000-0000-0000000c0001": "it-software-development",
  "00000000-0000-0000-0000-0000000c0002": "shigoto-it-gyoumu",
  "00000000-0000-0000-0000-0000000c0003": "shigoto-denwa-outai",
  "00000000-0000-0000-0000-0000000c0004": "hanasou-mensetsu",
  "00000000-0000-0000-0000-0000000c0005": "shadowing-motto-hanaseru",
  "00000000-0000-0000-0000-0000000c0006": "jlpt-n2-mondai1-kadai-rikai",
  "00000000-0000-0000-0000-0000000c0007": "jlpt-n2-mondai2-point-rikai",
  "00000000-0000-0000-0000-0000000c0008": "jlpt-n2-mondai3-gaiyou-rikai",
  "00000000-0000-0000-0000-0000000c0009": "jlpt-n2-mondai4-sokuji-outou",
  "00000000-0000-0000-0000-0000000c000a": "jlpt-n2-mondai5-tougou-rikai",
};

await getTokenizer();

if (process.env.DRY) {
  for (const t of [
    "しごとの日本語 ソフトウェア開発プロジェクト",
    "第1課 – 初回訪問のあいさつ",
    "Unit 1.1 ラーメンは日本食？",
    "Unit 1.2 旅につきもののお弁当",
    "Unit 3.2 快気祝い",
  ]) {
    console.log(t, "→", slugify(t));
  }
  process.exit(0);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const rx = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
const ui = rx[1]; const ci = ui.indexOf(":"); const [host, port] = rx[2].split(":");
const client = new pg.Client({
  user: ui.slice(0, ci), password: ui.slice(ci + 1), host, port: Number(port) || 5432,
  database: rx[3], ssl: { rejectUnauthorized: false },
});

function unique(base, used, fallback) {
  let s = base || fallback;
  let cand = s; let k = 2;
  while (used.has(cand)) cand = `${s}-${k++}`;
  used.add(cand);
  return cand;
}

await client.connect();
console.log("connected to", host);
try {
  await client.query("alter table public.courses add column if not exists slug text");
  await client.query("alter table public.lessons add column if not exists slug text");
  await client.query("create unique index if not exists courses_slug_idx on public.courses(slug)");
  await client.query("create unique index if not exists lessons_slug_idx on public.lessons(slug)");

  const courses = (await client.query("select id, title from public.courses order by order_index")).rows;
  const cUsed = new Set();
  for (const c of courses) {
    const slug = unique(COURSE_SLUGS[c.id] ?? slugify(c.title), cUsed, "course");
    await client.query("update public.courses set slug=$1 where id=$2", [slug, c.id]);
    console.log("course:", slug, "←", c.title);
  }

  const lessons = (await client.query("select id, title from public.lessons order by title")).rows;
  const lUsed = new Set();
  for (const l of lessons) {
    const slug = unique(slugify(l.title), lUsed, "lesson");
    await client.query("update public.lessons set slug=$1 where id=$2", [slug, l.id]);
  }
  console.log(`lessons: ${lessons.length} slugs set`);
} finally {
  await client.end();
}

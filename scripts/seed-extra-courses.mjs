// Seed placeholder courses (no lessons yet) into Supabase so they show in the
// UI. Idempotent (on conflict do update). Run: node scripts/seed-extra-courses.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const raw = env.SUPABASE_DB_URL;
if (!raw) throw new Error("SUPABASE_DB_URL not set in .env");
const m = raw.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
if (!m) throw new Error("Could not parse SUPABASE_DB_URL");
const [, userinfo, hostport, database] = m;
const ci = userinfo.indexOf(":");
const [host, port] = hostport.split(":");
const client = new pg.Client({
  user: userinfo.slice(0, ci),
  password: userinfo.slice(ci + 1),
  host,
  port: Number(port) || 5432,
  database,
  ssl: { rejectUnauthorized: false },
});

// order_index 0 is the existing main course (…0c0001).
const COURSES = [
  {
    id: "00000000-0000-0000-0000-0000000c0002",
    title: "しごとの日本語 IT業務編",
    description: "IT現場の業務でよく使う日本語表現を場面ごとに学ぶ教材。",
    topic: "IT業務",
    level: "N3-N2",
    accent: "#0ea5e9",
    image_url: "/course-covers/shigoto-it-gyoumu.jpg",
    order_index: 1,
  },
  {
    id: "00000000-0000-0000-0000-0000000c0003",
    title: "しごとの日本語 電話応対",
    description: "ビジネスの電話応対で使う日本語を、受け方から取次ぎまで練習する教材。",
    topic: "電話応対",
    level: "N3-N2",
    accent: "#f59e0b",
    image_url: "/course-covers/shigoto-denwa.jpg",
    order_index: 2,
  },
  {
    id: "00000000-0000-0000-0000-0000000c0004",
    title: "日本語を話そう 就職・アルバイト・進学面接編",
    description: "就職・アルバイト・進学の面接で話す日本語を練習する教材。",
    topic: "面接",
    level: "N4-N3",
    accent: "#a855f7",
    image_url: "/course-covers/hanasou-mensetsu.jpg",
    order_index: 3,
  },
  {
    id: "00000000-0000-0000-0000-0000000c0005",
    title: "シャドーイング もっと話せる日本語 中～上級編",
    description:
      "シャドーイングの練習方法を用いて、より長い会話、ワンランク上の会話力を身につける効果的な会話トレーニング本。日本や日本事情、対人関係をリアルに体感しながら、会話が長く円滑に続くことを目指す。",
    topic: "会話",
    level: "N2-N1",
    accent: "#f43f5e",
    image_url: "/course-covers/shadowing-motto-hanaseru.jpg",
    order_index: 4,
  },
];

await client.connect();
console.log("connected to", host);
try {
  for (const c of COURSES) {
    const res = await client.query(
      `insert into public.courses
         (id,user_id,title,description,topic,level,accent,image_url,order_index,is_public)
       values ($1,null,$2,$3,$4,$5,$6,$7,$8,true)
       on conflict (id) do update set
         title=excluded.title, description=excluded.description, topic=excluded.topic,
         level=excluded.level, accent=excluded.accent, image_url=excluded.image_url,
         order_index=excluded.order_index, is_public=excluded.is_public`,
      [c.id, c.title, c.description, c.topic, c.level, c.accent, c.image_url, c.order_index],
    );
    console.log(`ok: ${c.title} (rows: ${res.rowCount})`);
  }
  const total = await client.query(
    `select count(*)::int as n from public.courses where is_public = true`,
  );
  console.log("public courses now:", total.rows[0].n);
} finally {
  await client.end();
}

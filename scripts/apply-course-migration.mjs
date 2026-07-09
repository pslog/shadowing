// One-off, NON-DESTRUCTIVE migration: add courses table + course_id, create the
// single official course, and assign all public lessons to it. Reads
// SUPABASE_DB_URL from .env. Run: node scripts/apply-course-migration.mjs
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

// Manual parse (password may contain @ / ! that break URL parsing).
const m = raw.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);
if (!m) throw new Error("Could not parse SUPABASE_DB_URL");
const [, userinfo, hostport, database] = m;
const ci = userinfo.indexOf(":");
const user = userinfo.slice(0, ci);
const password = userinfo.slice(ci + 1);
const [host, port] = hostport.split(":");

const client = new pg.Client({
  user,
  password,
  host,
  port: Number(port) || 5432,
  database,
  ssl: { rejectUnauthorized: false },
});

const COURSE_ID = "00000000-0000-0000-0000-0000000c0001";

const statements = [
  `create table if not exists public.courses (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references public.profiles(id) on delete cascade,
     title text not null, description text, topic text, level text,
     accent text, image_url text, order_index int not null default 0,
     is_public boolean not null default false,
     created_at timestamptz not null default now())`,
  `alter table public.courses add column if not exists image_url text`,
  `alter table public.lessons add column if not exists course_id uuid references public.courses(id) on delete set null`,
  `alter table public.courses enable row level security`,
  `drop policy if exists "courses read own or public" on public.courses`,
  `drop policy if exists "courses write own" on public.courses`,
  `drop policy if exists "courses update own" on public.courses`,
  `drop policy if exists "courses delete own" on public.courses`,
  `create policy "courses read own or public" on public.courses for select using (auth.uid() = user_id or is_public = true)`,
  `create policy "courses write own" on public.courses for insert with check (auth.uid() = user_id)`,
  `create policy "courses update own" on public.courses for update using (auth.uid() = user_id)`,
  `create policy "courses delete own" on public.courses for delete using (auth.uid() = user_id)`,
  {
    text: `insert into public.courses (id,user_id,title,description,topic,level,accent,image_url,order_index,is_public)
           values ($1,null,$2,$3,$4,$5,$6,$7,0,true)
           on conflict (id) do update set
             title=excluded.title, description=excluded.description, topic=excluded.topic,
             level=excluded.level, accent=excluded.accent, image_url=excluded.image_url,
             is_public=excluded.is_public`,
    values: [
      COURSE_ID,
      "IT日本語 ソフトウェア開発プロジェクト",
      "ソフトウェア開発プロジェクトの現場で使う日本語を、初回訪問・キックオフから進捗報告・UAT・オンサイト終了まで順番に学ぶコース。",
      "IT日本語",
      "N3-N2",
      "#6366f1",
      "/course-covers/it-nihongo.jpg",
    ],
  },
  {
    text: `update public.lessons set course_id=$1 where user_id is null and is_public = true`,
    values: [COURSE_ID],
  },
];

await client.connect();
console.log("connected to", host);
try {
  for (const s of statements) {
    const q = typeof s === "string" ? { text: s } : s;
    const res = await client.query(q.text, q.values);
    const label = q.text.slice(0, 48).replace(/\s+/g, " ");
    console.log(`ok: ${label}${res.rowCount != null ? ` (rows: ${res.rowCount})` : ""}`);
  }
  const check = await client.query(
    `select count(*)::int as lessons_in_course from public.lessons where course_id=$1`,
    [COURSE_ID],
  );
  console.log("lessons now in course:", check.rows[0].lessons_in_course);
} finally {
  await client.end();
}

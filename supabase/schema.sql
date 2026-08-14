-- ============================================================================
--  Shadowing JP — Supabase schema
--  Run in the Supabase SQL editor (or `supabase db push`). Mirrors lib/types.ts.
--  Row Level Security: every user sees only their own rows (+ public lessons).
-- ============================================================================

-- ---------------------------------------------------------------------------
--  profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  display_name text,
  avatar_url text,
  total_xp int not null default 0,
  current_level int not null default 1,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_completed_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

update public.profiles
set role = 'admin'
where lower(coalesce(email, '')) = 'vovansinh1991@gmail.com';

-- ---------------------------------------------------------------------------
--  courses  (a group of related lessons: book / project / series)
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  topic text,
  level text,
  accent text,
  image_url text,
  order_index int not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add image_url if upgrading an existing database.
alter table public.courses
  add column if not exists image_url text;

-- ---------------------------------------------------------------------------
--  lessons
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  topic text,
  level text,
  duration_seconds int,
  source_type text not null default 'upload',
  source_url text,
  media_url text,
  is_public boolean not null default false,
  vocabulary jsonb not null default '[]'::jsonb,
  reading_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Add course_id if upgrading an existing database.
alter table public.lessons
  add column if not exists course_id uuid references public.courses(id) on delete set null;

-- Curated difficult-vocabulary list (word/reading/meaning/example) per lesson.
alter table public.lessons
  add column if not exists vocabulary jsonb not null default '[]'::jsonb;

-- Reading-specific display/test metadata:
-- { watermark, memo: { ja, vi }, readingCheck: [{ question, choices, answer, explanation }] }
alter table public.lessons
  add column if not exists reading_meta jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
--  lesson_sentences
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_sentences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  order_index int not null,
  ja_text text not null,
  furigana text,
  vi_translation text,
  audio_url text,
  audio_start numeric,
  audio_end numeric,
  pass_score int not null default 80,
  created_at timestamptz not null default now()
);
alter table public.lesson_sentences
  add column if not exists audio_url text;
-- Furigana (ruby): JSON array of [surface] / [surface, hiraganaReading].
alter table public.lesson_sentences
  add column if not exists furigana text;
create index if not exists lesson_sentences_lesson_idx
  on public.lesson_sentences(lesson_id, order_index);

-- ---------------------------------------------------------------------------
--  saved_vocab  (personal vocabulary notebook for review / flashcards)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  word text not null,
  reading text not null,
  meaning text not null,
  example_ja text not null,
  example_vi text not null,
  learned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, word, reading)
);
create index if not exists saved_vocab_user_idx
  on public.saved_vocab(user_id, created_at);

-- Aggregate popularity per word across ALL users (how many saved it / learned
-- it). security_invoker=false so it runs as owner and bypasses saved_vocab RLS,
-- exposing only counts (never who saved). Readable by everyone.
create or replace view public.vocab_stats
with (security_invoker = false) as
select
  word,
  reading,
  count(*)::int                        as saved_count,
  count(*) filter (where learned)::int as learned_count
from public.saved_vocab
group by word, reading;
grant select on public.vocab_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
--  sentence_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.sentence_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  sentence_id uuid references public.lesson_sentences(id) on delete cascade,
  recording_url text,
  pronunciation_score int,
  speed_score int,
  coverage_score int,
  intonation_score int,
  total_score int,
  transcript_text text,
  duration_seconds numeric,
  is_passed boolean not null default false,
  feedback text,
  created_at timestamptz not null default now()
);
alter table public.sentence_attempts
  add column if not exists coverage_score int;
create index if not exists sentence_attempts_user_idx
  on public.sentence_attempts(user_id, created_at);

-- ---------------------------------------------------------------------------
--  lesson_progress
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'in_progress',
  passed_sentence_count int not null default 0,
  total_sentence_count int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
--  reading_progress  (read-completion state for reading lessons)
-- ---------------------------------------------------------------------------
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_session_id text,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_progress_identity_chk
    check (user_id is not null or anonymous_session_id is not null)
);

create index if not exists reading_progress_lesson_idx
  on public.reading_progress(lesson_id, updated_at desc);
create index if not exists reading_progress_user_idx
  on public.reading_progress(user_id, updated_at desc);
create index if not exists reading_progress_anonymous_session_idx
  on public.reading_progress(anonymous_session_id, updated_at desc);
create unique index if not exists reading_progress_user_lesson_unique
  on public.reading_progress(user_id, lesson_id)
  where user_id is not null;
create unique index if not exists reading_progress_anonymous_lesson_unique
  on public.reading_progress(anonymous_session_id, lesson_id)
  where anonymous_session_id is not null;

-- ---------------------------------------------------------------------------
--  lesson_views  (lightweight lesson view analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_views (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists lesson_views_lesson_created_idx
  on public.lesson_views(lesson_id, created_at desc);
create index if not exists lesson_views_user_created_idx
  on public.lesson_views(user_id, created_at desc);
create index if not exists lesson_views_anonymous_session_idx
  on public.lesson_views(anonymous_session_id);

drop view if exists public.lesson_view_stats;
create view public.lesson_view_stats
with (security_invoker = false) as
with view_rollup as (
  select
    lesson_id,
    count(*)::int as total_views,
    count(distinct user_id)::int as signed_in_viewers,
    count(distinct anonymous_session_id)::int as anonymous_viewers,
    min(created_at) as first_viewed_at,
    max(created_at) as last_viewed_at
  from public.lesson_views
  group by lesson_id
),
attempt_rollup as (
  select
    lesson_id,
    count(*)::int as shadowing_attempts,
    count(distinct user_id)::int as shadowing_users
  from public.sentence_attempts
  group by lesson_id
),
completion_rollup as (
  select
    lesson_id,
    count(*) filter (where status = 'completed')::int as completed_users
  from public.lesson_progress
  group by lesson_id
)
select
  l.id as lesson_id,
  l.title as lesson_title,
  l.slug as lesson_slug,
  l.course_id,
  l.topic,
  l.level,
  coalesce(v.total_views, 0)::int as total_views,
  coalesce(v.signed_in_viewers, 0)::int as signed_in_viewers,
  coalesce(v.anonymous_viewers, 0)::int as anonymous_viewers,
  coalesce(a.shadowing_attempts, 0)::int as shadowing_attempts,
  coalesce(a.shadowing_users, 0)::int as shadowing_users,
  coalesce(c.completed_users, 0)::int as completed_users,
  v.first_viewed_at,
  v.last_viewed_at
from public.lessons l
left join view_rollup v on v.lesson_id = l.id
left join attempt_rollup a on a.lesson_id = l.id
left join completion_rollup c on c.lesson_id = l.id;

create or replace view public.lesson_view_overview
with (security_invoker = false) as
with view_summary as (
  select
    count(*)::int as total_views,
    count(distinct lesson_id)::int as viewed_lesson_count,
    count(distinct user_id)::int as signed_in_viewers,
    count(distinct anonymous_session_id)::int as anonymous_viewers,
    min(created_at) as first_viewed_at,
    max(created_at) as last_viewed_at
  from public.lesson_views
),
attempt_summary as (
  select count(distinct user_id)::int as shadowing_users
  from public.sentence_attempts
),
completion_summary as (
  select count(distinct user_id)::int as completed_users
  from public.lesson_progress
  where status = 'completed'
)
select
  v.total_views,
  v.viewed_lesson_count,
  v.signed_in_viewers,
  v.anonymous_viewers,
  v.first_viewed_at,
  v.last_viewed_at,
  coalesce(a.shadowing_users, 0)::int as shadowing_users,
  coalesce(c.completed_users, 0)::int as completed_users
from view_summary v
cross join attempt_summary a
cross join completion_summary c;

create or replace view public.course_engagement_stats
with (security_invoker = false) as
select
  coalesce(l.course_id::text, '__uncategorized__') as course_id,
  coalesce(sum(s.total_views), 0)::int as total_views,
  coalesce(sum(s.shadowing_users), 0)::int as shadowing_users,
  coalesce(sum(s.completed_users), 0)::int as completed_users
from public.lessons l
left join public.lesson_view_stats s on s.lesson_id = l.id
where l.is_public = true
group by coalesce(l.course_id::text, '__uncategorized__');

-- ---------------------------------------------------------------------------
--  site_visits  (site-wide page visit analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_idx
  on public.site_visits(created_at desc);
create index if not exists site_visits_user_created_idx
  on public.site_visits(user_id, created_at desc);
create index if not exists site_visits_anonymous_session_idx
  on public.site_visits(anonymous_session_id);

create or replace view public.site_visit_overview
with (security_invoker = true)
as
select
  count(*)::int as total_visits,
  count(distinct user_id)::int as signed_in_visitors,
  count(distinct anonymous_session_id)::int as anonymous_visitors,
  min(created_at) as first_visited_at,
  max(created_at) as last_visited_at
from public.site_visits;

-- ---------------------------------------------------------------------------
--  daily_missions
-- ---------------------------------------------------------------------------
create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_date date not null,
  target_sentence_count int not null default 5,
  passed_sentence_count int not null default 0,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, mission_date)
);

-- ---------------------------------------------------------------------------
--  xp_events
-- ---------------------------------------------------------------------------
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  xp_amount int not null,
  lesson_id uuid references public.lessons(id) on delete set null,
  sentence_id uuid references public.lesson_sentences(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Auto-create a profile row when a new auth user signs up.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, display_name, avatar_url)
  values (
    new.id,
    new.email,
    case when lower(coalesce(new.email, '')) = 'vovansinh1991@gmail.com'
      then 'admin'
      else 'user'
    end,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com';
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    );
$$;

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'vovansinh1991@gmail.com' then
    new.role := 'admin';
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is null then
      new.role := 'user';
    end if;
    if new.role <> 'user' and not public.current_user_is_super_admin() then
      raise exception 'Only the super admin can create admin profiles';
    end if;
    return new;
  end if;

  if lower(coalesce(old.email, '')) = 'vovansinh1991@gmail.com' then
    new.email := old.email;
    new.role := 'admin';
    return new;
  end if;

  if new.email is distinct from old.email and not public.current_user_is_super_admin() then
    raise exception 'Only the super admin can change profile emails';
  end if;

  if new.role is distinct from old.role and not public.current_user_is_super_admin() then
    raise exception 'Only the super admin can change user roles';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

grant execute on function public.current_user_is_super_admin() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_sentences  enable row level security;
alter table public.sentence_attempts enable row level security;
alter table public.saved_vocab       enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.lesson_views      enable row level security;
alter table public.site_visits       enable row level security;
alter table public.daily_missions    enable row level security;
alter table public.xp_events         enable row level security;

drop policy if exists "profiles self" on public.profiles;
drop policy if exists "profiles read self or admin" on public.profiles;
drop policy if exists "profiles insert self" on public.profiles;
drop policy if exists "profiles update self" on public.profiles;
drop policy if exists "profiles super admin update" on public.profiles;
drop policy if exists "courses read own or public" on public.courses;
drop policy if exists "courses write own" on public.courses;
drop policy if exists "courses update own" on public.courses;
drop policy if exists "courses delete own" on public.courses;
drop policy if exists "lessons read own or public" on public.lessons;
drop policy if exists "lessons write own" on public.lessons;
drop policy if exists "lessons update own" on public.lessons;
drop policy if exists "lessons delete own" on public.lessons;
drop policy if exists "sentences read" on public.lesson_sentences;
drop policy if exists "sentences write own" on public.lesson_sentences;
drop policy if exists "courses admin all" on public.courses;
drop policy if exists "lessons admin all" on public.lessons;
drop policy if exists "sentences admin all" on public.lesson_sentences;
drop policy if exists "attempts self" on public.sentence_attempts;
drop policy if exists "saved_vocab self" on public.saved_vocab;
drop policy if exists "progress self" on public.lesson_progress;
drop policy if exists "lesson_views insert readable lesson" on public.lesson_views;
drop policy if exists "lesson_views admin read" on public.lesson_views;
drop policy if exists "site_visits admin read" on public.site_visits;
drop policy if exists "missions self" on public.daily_missions;
drop policy if exists "xp self" on public.xp_events;

-- profiles: users manage their own row; admins can list users; only the
-- immutable super admin can change roles through the trigger-guarded table.
create policy "profiles read self or admin" on public.profiles
  for select using (auth.uid() = id or public.current_user_is_admin());
create policy "profiles insert self" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles super admin update" on public.profiles
  for update using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

-- courses: own rows are read/write; public courses are read-only for everyone.
create policy "courses read own or public" on public.courses
  for select using (auth.uid() = user_id or is_public = true);
create policy "courses write own" on public.courses
  for insert with check (auth.uid() = user_id);
create policy "courses update own" on public.courses
  for update using (auth.uid() = user_id);
create policy "courses delete own" on public.courses
  for delete using (auth.uid() = user_id);

-- lessons: own rows are read/write; public lessons are read-only for everyone.
create policy "lessons read own or public" on public.lessons
  for select using (auth.uid() = user_id or is_public = true);
create policy "lessons write own" on public.lessons
  for insert with check (auth.uid() = user_id);
create policy "lessons update own" on public.lessons
  for update using (auth.uid() = user_id);
create policy "lessons delete own" on public.lessons
  for delete using (auth.uid() = user_id);

-- lesson_sentences: readable if the parent lesson is readable; writable if owned.
create policy "sentences read" on public.lesson_sentences
  for select using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and (l.user_id = auth.uid() or l.is_public = true)
    )
  );
create policy "sentences write own" on public.lesson_sentences
  for all using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- Admin override: the fixed admin account may write public/system content
-- (seed courses/lessons/sentences owned by null), e.g. fixing sentence timing.
create policy "courses admin all" on public.courses
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "lessons admin all" on public.lessons
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "sentences admin all" on public.lesson_sentences
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Per-user tables: full self access.
create policy "attempts self" on public.sentence_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_vocab self" on public.saved_vocab
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress self" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lesson_views insert readable lesson" on public.lesson_views
  for insert with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id and (l.is_public = true or l.user_id = auth.uid())
    )
  );
create policy "lesson_views admin read" on public.lesson_views
  for select using (public.current_user_is_admin());
create policy "site_visits admin read" on public.site_visits
  for select using (public.current_user_is_admin());
create policy "missions self" on public.daily_missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xp self" on public.xp_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

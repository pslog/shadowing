-- ============================================================================
--  Shadow IT Japanese — Supabase schema
--  Run in the Supabase SQL editor (or `supabase db push`). Mirrors lib/types.ts.
--  Row Level Security: every user sees only their own rows (+ public lessons).
-- ============================================================================

-- ---------------------------------------------------------------------------
--  profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  total_xp int not null default 0,
  current_level int not null default 1,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_completed_date date,
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

-- Add course_id if upgrading an existing database.
alter table public.lessons
  add column if not exists course_id uuid references public.courses(id) on delete set null;

-- ---------------------------------------------------------------------------
--  lesson_sentences
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_sentences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  order_index int not null,
  ja_text text not null,
  vi_translation text,
  audio_url text,
  audio_start numeric,
  audio_end numeric,
  pass_score int not null default 80,
  created_at timestamptz not null default now()
);
alter table public.lesson_sentences
  add column if not exists audio_url text;
create index if not exists lesson_sentences_lesson_idx
  on public.lesson_sentences(lesson_id, order_index);

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
  intonation_score int,
  total_score int,
  transcript_text text,
  duration_seconds numeric,
  is_passed boolean not null default false,
  feedback text,
  created_at timestamptz not null default now()
);
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
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
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

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_sentences  enable row level security;
alter table public.sentence_attempts enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.daily_missions    enable row level security;
alter table public.xp_events         enable row level security;

drop policy if exists "profiles self" on public.profiles;
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
drop policy if exists "progress self" on public.lesson_progress;
drop policy if exists "missions self" on public.daily_missions;
drop policy if exists "xp self" on public.xp_events;

-- profiles: a user manages only their own row.
create policy "profiles self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

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
  for all using ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com');
create policy "lessons admin all" on public.lessons
  for all using ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com');
create policy "sentences admin all" on public.lesson_sentences
  for all using ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com');

-- Per-user tables: full self access.
create policy "attempts self" on public.sentence_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress self" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "missions self" on public.daily_missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xp self" on public.xp_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

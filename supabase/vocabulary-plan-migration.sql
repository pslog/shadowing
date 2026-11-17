-- Vocabulary book study plans + spaced-repetition intervals.
-- NON-DESTRUCTIVE and safe to re-run. Apply: node scripts/apply-vocabulary-plan-migration.mjs

create table if not exists public.vocabulary_book_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.vocabulary_books(id) on delete cascade,
  start_date date not null,
  words_per_day int not null check (words_per_day > 0),
  reviews_done int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

alter table public.vocabulary_book_plans enable row level security;
drop policy if exists "vocabulary book plans self" on public.vocabulary_book_plans;
create policy "vocabulary book plans self" on public.vocabulary_book_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- interval_days: 0 = never answered correctly, otherwise the current SRS rung
-- (1, 3, 7, 14, 30, 60, 120 days). `mastered` now means interval >= 30.
alter table public.vocabulary_book_quiz_progress
  add column if not exists interval_days int not null default 0;

-- One-time backfill: the old rule retired a word after two correct answers in
-- a row. Put those words back on the ladder (7 days) so they are reviewed
-- again, and words answered correctly once at 1 day.
update public.vocabulary_book_quiz_progress
set interval_days = case when mastered then 7 else 1 end,
    mastered = false
where interval_days = 0 and (mastered or correct_streak > 0);

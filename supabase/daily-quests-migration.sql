-- ---------------------------------------------------------------------------
--  Daily quest board
--
--  The daily mission used to be a single number (pass N sentences). It now
--  carries three quests — shadowing, 読解, vocabulary — plus the once-a-day
--  bonus for clearing all three. Existing rows keep their shadowing columns and
--  default into an un-started reading/vocab quest.
--
--  Safe to run on an existing database.
-- ---------------------------------------------------------------------------
alter table public.daily_missions
  add column if not exists reading_target int not null default 1,
  add column if not exists reading_count  int not null default 0,
  add column if not exists vocab_target   int not null default 10,
  add column if not exists vocab_count    int not null default 0,
  add column if not exists bonus_awarded  boolean not null default false;

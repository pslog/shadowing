-- Speaker label for dialogue lines (e.g. 'A' / 'B' / 'C'); null = narration.
alter table public.lesson_sentences
  add column if not exists speaker text;

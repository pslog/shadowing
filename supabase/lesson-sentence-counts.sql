-- Sentence count per lesson, as a view.
--
-- Course pages show "passed/total câu" and a percentage for every lesson, but
-- lesson_sentences is loaded LAZILY (one lesson at a time — the N2 course alone
-- has 900+ lessons), so those totals used to come out as 0 and every lesson read
-- "chưa học · 0%". lesson_progress covers lessons the learner has touched; this
-- view covers the rest, at one small request instead of every sentence row.
--
-- security_invoker: the view is read with the caller's permissions, so the
-- existing "sentences read" policy on lesson_sentences still decides what is
-- visible (public lessons for anyone, own lessons for their owner).
create or replace view public.lesson_sentence_counts
  with (security_invoker = true) as
select lesson_id, count(*)::int as sentence_count
from public.lesson_sentences
group by lesson_id;

grant select on public.lesson_sentence_counts to anon, authenticated;

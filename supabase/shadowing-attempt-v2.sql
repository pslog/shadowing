-- Deployment prerequisite. Do NOT run automatically against production.
-- Atomic persistence for the existing client scoring contract; not a trusted
-- acoustic scoring service. Existing RLS remains in force (SECURITY INVOKER).
create or replace function public.save_shadowing_attempt_v2(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  owner uuid := auth.uid();
  a public.sentence_attempts;
  p public.profiles;
  lp public.lesson_progress;
  dm public.daily_missions;
  e public.xp_events;
  current_xp integer;
  attempt_count bigint;
  sentence_pass_score integer;
begin
  if owner is null then raise exception 'authentication_required'; end if;
  a := jsonb_populate_record(null::public.sentence_attempts, payload->'attempt');
  p := jsonb_populate_record(null::public.profiles, payload->'profile');
  lp := jsonb_populate_record(null::public.lesson_progress, payload->'progress');
  dm := jsonb_populate_record(null::public.daily_missions, payload->'mission');
  if a.user_id is distinct from owner or p.id is distinct from owner
    or lp.user_id is distinct from owner or dm.user_id is distinct from owner
    or lp.lesson_id is distinct from a.lesson_id then
    raise exception 'identity_mismatch';
  end if;
  -- Serializes concurrent saves for one account. All writes below roll back
  -- together on error, including a failure after the attempt insert.
  select total_xp into current_xp from public.profiles where id = owner for update;
  if not found then raise exception 'profile_missing'; end if;
  if exists(select 1 from public.sentence_attempts where id = a.id and user_id = owner) then
    if exists(select 1 from public.sentence_attempts where id = a.id and
      (sentence_id is distinct from a.sentence_id or transcript_text is distinct from a.transcript_text)) then
      raise exception 'attempt_id_conflict';
    end if;
    return jsonb_build_object('duplicate', true);
  end if;
  select count(*) into attempt_count from public.sentence_attempts where user_id = owner;
  if current_xp is distinct from (payload->>'expected_xp')::integer
    or attempt_count is distinct from (payload->>'expected_attempt_count')::bigint then
    raise exception 'stale_attempt_state';
  end if;
  select pass_score into sentence_pass_score from public.lesson_sentences
    where id = a.sentence_id and lesson_id = a.lesson_id;
  if not found then
    raise exception 'sentence_mismatch';
  end if;
  if a.total_score is null or a.total_score not between 0 and 100
    or (a.is_passed and (a.total_score < sentence_pass_score or coalesce(a.pronunciation_score,0) < 91 or coalesce(a.coverage_score,0) < 80 or coalesce(length(trim(a.transcript_text)),0) = 0)) then
    raise exception 'invalid_score';
  end if;
  if p.total_xp <> current_xp + coalesce((select sum((value->>'xp_amount')::integer) from jsonb_array_elements(payload->'xp_events')),0) then
    raise exception 'xp_mismatch';
  end if;
  insert into public.sentence_attempts select a.*;
  insert into public.lesson_progress select lp.*
    on conflict(user_id,lesson_id) do update set
      status=excluded.status, passed_sentence_count=excluded.passed_sentence_count,
      total_sentence_count=excluded.total_sentence_count,
      completed_at=excluded.completed_at, updated_at=excluded.updated_at;
  insert into public.daily_missions select dm.*
    on conflict(user_id,mission_date) do update set
      passed_sentence_count=excluded.passed_sentence_count,
      is_completed=excluded.is_completed,
      reading_count=greatest(daily_missions.reading_count,excluded.reading_count),
      vocab_count=greatest(daily_missions.vocab_count,excluded.vocab_count),
      bonus_awarded=daily_missions.bonus_awarded or excluded.bonus_awarded;
  for e in select * from jsonb_populate_recordset(null::public.xp_events,payload->'xp_events') loop
    if e.user_id is distinct from owner or e.lesson_id is distinct from a.lesson_id or e.xp_amount < 0 then
      raise exception 'event_mismatch';
    end if;
    insert into public.xp_events select e.*;
  end loop;
  update public.profiles set total_xp=p.total_xp,current_level=p.current_level,
    current_streak=p.current_streak,longest_streak=p.longest_streak,
    last_completed_date=p.last_completed_date where id=owner;
  return jsonb_build_object('duplicate',false);
end;
$$;
revoke all on function public.save_shadowing_attempt_v2(jsonb) from public;
revoke all on function public.save_shadowing_attempt_v2(jsonb) from anon;
grant execute on function public.save_shadowing_attempt_v2(jsonb) to authenticated;

alter table public.review_materials
  add column if not exists subject_folder_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.review_materials'::regclass
      AND conname = 'review_materials_subject_folder_id_fkey'
  ) THEN
    ALTER TABLE public.review_materials
      ADD CONSTRAINT review_materials_subject_folder_id_fkey
      FOREIGN KEY (subject_folder_id) REFERENCES public.user_subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists idx_review_materials_subject_folder
  on public.review_materials(user_id, subject_folder_id);

create or replace function public.update_my_profile_progress(p_correct integer, p_total integer)
returns table(previous_level integer, level integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_previous_level integer;
  v_level integer;
  v_current_streak integer;
  v_xp_gain integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if p_total is null or p_correct is null
    or p_total < 1 or p_total > 10000 or p_correct < 0 or p_correct > p_total then
    raise exception 'Progress values are invalid.';
  end if;

  select p.level into v_previous_level
  from public.profiles p
  where p.id = v_user_id
  for update;
  if not found then
    raise exception 'Profile not found.';
  end if;

  select case
    when p.last_activity_date = v_today then coalesce(p.current_streak, 0)
    when p.last_activity_date = v_today - 1 then coalesce(p.current_streak, 0) + 1
    else 1
  end
  into v_current_streak
  from public.profiles p
  where p.id = v_user_id;

  v_xp_gain := p_correct * 10 + (p_total - p_correct) * 2;
  update public.profiles p
  set xp = coalesce(p.xp, 0) + v_xp_gain,
      level = floor((coalesce(p.xp, 0) + v_xp_gain)::numeric / 100)::integer + 1,
      current_streak = v_current_streak,
      longest_streak = greatest(coalesce(p.longest_streak, 0), v_current_streak),
      last_activity_date = v_today,
      daily_items_completed = case
        when p.daily_goal_date = v_today then coalesce(p.daily_items_completed, 0) + p_total
        else p_total
      end,
      daily_goal_date = v_today,
      updated_at = now()
  where p.id = v_user_id
  returning p.level into v_level;

  return query select v_previous_level, v_level;
end;
$$;

create or replace function public.normalize_answer_text(p_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9[:space:]]', '', 'g'),
    '[[:space:]]+', ' ', 'g'
  ));
$$;

create or replace function public.record_practice_attempt(p_practice_item_id uuid, p_response jsonb)
returns table(is_correct boolean, previous_level integer, level integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.practice_items%rowtype;
  v_correct boolean := false;
  v_user_text text;
  v_user_order text[];
  v_expected_order text[];
  v_expected_count integer;
  v_matched_count integer;
  v_input_count integer;
  v_distinct_input_count integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select i.* into v_item
  from public.practice_items i
  where i.id = p_practice_item_id and i.user_id = v_user_id
  for update;
  if not found then raise exception 'Practice item not found.'; end if;

  if v_item.type = 'mcq' then
    v_correct := jsonb_typeof(p_response) = 'object'
      and coalesce(p_response->>'selected', '') ~ '^[0-9]+$'
      and p_response->>'selected' = v_item.answer->>'correctIndex';
  elsif v_item.type in ('diagnosis', 'identification') then
    v_user_text := public.normalize_answer_text(p_response->>'text');
    if v_user_text <> '' then
      select exists (
        select 1
        from jsonb_array_elements_text(
          jsonb_build_array(v_item.answer->'expected')
            || coalesce(v_item.answer->'acceptable', '[]'::jsonb)
        ) candidate(value)
        where public.normalize_answer_text(candidate.value) <> ''
          and (
            v_user_text = public.normalize_answer_text(candidate.value)
            or position(public.normalize_answer_text(candidate.value) in v_user_text) > 0
            or position(v_user_text in public.normalize_answer_text(candidate.value)) > 0
          )
      ) into v_correct;
    end if;
  elsif v_item.type = 'sequence' then
    if jsonb_typeof(p_response->'order') = 'array'
      and jsonb_typeof(v_item.answer->'order') = 'array'
      and jsonb_array_length(p_response->'order') >= 2
      and jsonb_array_length(p_response->'order') = jsonb_array_length(v_item.answer->'order') then
      select array_agg(public.normalize_answer_text(value) order by ordinality)
      into v_user_order
      from jsonb_array_elements_text(p_response->'order') with ordinality;
      select array_agg(public.normalize_answer_text(value) order by ordinality)
      into v_expected_order
      from jsonb_array_elements_text(v_item.answer->'order') with ordinality;
      v_correct := v_user_order = v_expected_order;
    end if;
  elsif v_item.type = 'enumeration' then
    v_user_text := coalesce(p_response->>'text', '');
    select count(*) into v_expected_count
    from jsonb_array_elements_text(v_item.answer->'items');
    select count(*) into v_matched_count
    from regexp_split_to_table(v_user_text, E'[\\n,;]+') user_part(value)
    where public.normalize_answer_text(user_part.value) <> ''
      and exists (
        select 1
        from jsonb_array_elements_text(v_item.answer->'items') expected_part(value)
        where public.normalize_answer_text(expected_part.value) <> ''
          and (
            public.normalize_answer_text(user_part.value) = public.normalize_answer_text(expected_part.value)
            or position(public.normalize_answer_text(user_part.value) in public.normalize_answer_text(expected_part.value)) > 0
            or position(public.normalize_answer_text(expected_part.value) in public.normalize_answer_text(user_part.value)) > 0
          )
      );
    select count(*), count(distinct public.normalize_answer_text(user_part.value))
    into v_input_count, v_distinct_input_count
    from regexp_split_to_table(v_user_text, E'[\\n,;]+') user_part(value)
    where public.normalize_answer_text(user_part.value) <> '';
    v_correct := v_expected_count > 0
      and v_matched_count = v_expected_count
      and v_input_count = v_expected_count
      and v_distinct_input_count = v_expected_count;
  else
    raise exception 'This practice item type cannot record an answer.';
  end if;

  insert into public.attempts (
    user_id, practice_item_id, board_program, subject, type, user_response, is_correct
  ) values (
    v_user_id, v_item.id, v_item.board_program, v_item.subject, v_item.type, p_response, v_correct
  );
  return query
  select v_correct, progress.previous_level, progress.level
  from public.update_my_profile_progress(case when v_correct then 1 else 0 end, 1) progress;
end;
$$;

create or replace function public.record_flashcard_review(
  p_flashcard_id uuid,
  p_quality text,
  p_expected_last_reviewed_at timestamptz,
  p_schedule jsonb
)
returns table(previous_level integer, level integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.flashcards%rowtype;
  v_quality_score integer;
  v_ease numeric;
  v_interval integer;
  v_repetitions integer;
  v_next_review timestamptz;
  v_last_reviewed timestamptz;
  v_last_quality integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  v_quality_score := case p_quality when 'again' then 1 when 'hard' then 3 when 'good' then 4 when 'easy' then 5 else null end;
  if v_quality_score is null or jsonb_typeof(p_schedule) is distinct from 'object' then
    raise exception 'Flashcard review values are invalid.';
  end if;

  select c.* into v_card
  from public.flashcards c
  where c.id = p_flashcard_id and c.user_id = v_user_id
  for update;
  if not found then raise exception 'Flashcard not found.'; end if;
  if v_card.last_reviewed_at is distinct from p_expected_last_reviewed_at then
    raise exception 'This flashcard was already reviewed. Reload before rating it again.';
  end if;

  v_ease := (p_schedule->>'ease_factor')::numeric;
  v_interval := (p_schedule->>'interval_minutes')::integer;
  v_repetitions := (p_schedule->>'repetitions')::integer;
  v_next_review := (p_schedule->>'next_review_at')::timestamptz;
  v_last_reviewed := (p_schedule->>'last_reviewed_at')::timestamptz;
  v_last_quality := (p_schedule->>'last_quality')::integer;
  if v_ease is null or v_interval is null or v_repetitions is null
    or v_next_review is null or v_last_reviewed is null or v_last_quality is null
    or v_ease < 1.3 or v_ease > 10 or v_interval < 1 or v_interval > 525600
    or v_repetitions < 0 or v_repetitions > 100000
    or v_last_quality <> v_quality_score
    or v_last_reviewed < now() - interval '2 minutes'
    or v_last_reviewed > now() + interval '30 seconds'
    or v_next_review <= v_last_reviewed then
    raise exception 'Flashcard schedule is invalid.';
  end if;

  update public.flashcards c
  set ease_factor = v_ease,
      interval_minutes = v_interval,
      repetitions = v_repetitions,
      next_review_at = v_next_review,
      last_reviewed_at = v_last_reviewed,
      last_quality = v_last_quality
  where c.id = v_card.id;

  return query
  select progress.previous_level, progress.level
  from public.update_my_profile_progress(case when v_quality_score > 1 then 1 else 0 end, 1) progress;
end;
$$;

create or replace function public.submit_mock_exam(p_exam_id uuid, p_answers jsonb)
returns table(score numeric, passed boolean, previous_level integer, level integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_exam public.mock_exams%rowtype;
  v_item public.mock_exam_items%rowtype;
  v_response jsonb;
  v_correct boolean;
  v_correct_count integer := 0;
  v_total integer;
  v_answer_count integer;
  v_subjects_pass boolean;
  v_score numeric;
  v_passed boolean;
  v_previous_level integer;
  v_level integer;
  v_user_order text[];
  v_expected_order text[];
  v_user_text text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answers must be provided as an array.';
  end if;

  select e.* into v_exam
  from public.mock_exams e
  where e.id = p_exam_id and e.user_id = v_user_id
  for update;
  if not found then
    raise exception 'Mock exam not found.';
  end if;
  if v_exam.status = 'submitted' then
    select coalesce(p.level, 1) into v_level
    from public.profiles p where p.id = v_user_id;
    return query select v_exam.score, v_exam.passed, v_level, v_level;
    return;
  end if;
  if v_exam.status <> 'in_progress' then
    raise exception 'Mock exam has already been submitted.';
  end if;

  select count(*) into v_total
  from public.mock_exam_items i
  where i.exam_id = p_exam_id;
  select count(*) into v_answer_count
  from jsonb_array_elements(p_answers);

  if v_total = 0 or v_answer_count <> v_total or v_total <> v_exam.total_items then
    raise exception 'The answer list does not match the exam.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_answers) as a(answer)
    group by a.answer->>'item_id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_answers) as a(answer)
    where a.answer->>'item_id' is null
       or not exists (
         select 1
         from public.mock_exam_items i
         where i.exam_id = p_exam_id and i.id::text = a.answer->>'item_id'
       )
  ) then
    raise exception 'The answer list contains duplicate or unknown exam items.';
  end if;

  for v_item in
    select i.*
    from public.mock_exam_items i
    where i.exam_id = p_exam_id
    order by i.position
  loop
    select a.answer->'user_response' into v_response
    from jsonb_array_elements(p_answers) as a(answer)
    where a.answer->>'item_id' = v_item.id::text;

    v_correct := false;
    if v_item.type = 'mcq' then
      v_correct := jsonb_typeof(v_response) = 'object'
        and coalesce(v_response->>'selected', '') ~ '^[0-9]+$'
        and v_response->>'selected' = v_item.answer->>'correctIndex';
    elsif v_item.type in ('diagnosis', 'identification') then
      v_user_text := public.normalize_answer_text(v_response->>'text');
      if v_user_text <> '' then
        select exists (
          select 1
          from jsonb_array_elements_text(
            jsonb_build_array(v_item.answer->'expected')
              || coalesce(v_item.answer->'acceptable', '[]'::jsonb)
          ) candidate(value)
          where public.normalize_answer_text(candidate.value) <> ''
            and (
              v_user_text = public.normalize_answer_text(candidate.value)
              or position(public.normalize_answer_text(candidate.value) in v_user_text) > 0
              or position(v_user_text in public.normalize_answer_text(candidate.value)) > 0
            )
        ) into v_correct;
      end if;
    elsif v_item.type = 'sequence' then
      if jsonb_typeof(v_response->'order') = 'array'
        and jsonb_typeof(v_item.answer->'order') = 'array'
        and jsonb_array_length(v_response->'order') >= 2
        and jsonb_array_length(v_response->'order') = jsonb_array_length(v_item.answer->'order') then
        select array_agg(public.normalize_answer_text(value) order by ordinality)
        into v_user_order
        from jsonb_array_elements_text(v_response->'order') with ordinality;
        select array_agg(public.normalize_answer_text(value) order by ordinality)
        into v_expected_order
        from jsonb_array_elements_text(v_item.answer->'order') with ordinality;
        v_correct := v_user_order = v_expected_order;
      end if;
    end if;

    update public.mock_exam_items i
    set user_response = v_response, is_correct = v_correct
    where i.id = v_item.id;

    insert into public.attempts (
      user_id, practice_item_id, board_program, subject, type, user_response, is_correct
    ) values (
      v_user_id, v_item.practice_item_id, v_exam.board_program, v_item.subject,
      v_item.type, v_response, v_correct
    );

    if v_correct then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  v_score := round(v_correct_count * 1000.0 / v_total) / 10;
  select coalesce(bool_and(subject_correct * 2 >= subject_total), true)
  into v_subjects_pass
  from (
    select i.subject,
      count(*) as subject_total,
      count(*) filter (where i.is_correct) as subject_correct
    from public.mock_exam_items i
    where i.exam_id = p_exam_id
    group by i.subject
  ) subject_scores;
  v_passed := v_score >= 75 and v_subjects_pass;

  update public.mock_exams e
  set status = 'submitted',
      submitted_at = now(),
      score = v_score,
      passed = v_passed
  where e.id = p_exam_id;

  select p.previous_level, p.level
  into v_previous_level, v_level
  from public.update_my_profile_progress(v_correct_count, v_total) p;

  return query select v_score, v_passed, v_previous_level, v_level;
end;
$$;

create or replace function public.move_review_material_to_folder(p_material_id uuid, p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if not exists (
    select 1 from public.user_subjects s
    where s.id = p_folder_id and s.user_id = v_user_id
  ) then
    raise exception 'Subject folder not found.';
  end if;

  update public.review_materials m
  set subject_folder_id = p_folder_id
  where m.id = p_material_id and m.user_id = v_user_id;
  if not found then
    raise exception 'Reviewer not found.';
  end if;
end;
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke insert, update on public.profiles from PUBLIC, anon, authenticated;
grant insert (id, full_name, board_program, target_exam_date, track, updated_at)
  on public.profiles to authenticated;
grant update (id, full_name, board_program, target_exam_date, track, updated_at)
  on public.profiles to authenticated;
revoke update on public.review_materials from PUBLIC, anon, authenticated;

revoke all on function public.update_my_profile_progress(integer, integer) from PUBLIC, anon, authenticated;
revoke all on function public.record_practice_attempt(uuid, jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.record_practice_attempt(uuid, jsonb) to authenticated;
revoke all on function public.record_flashcard_review(uuid, text, timestamptz, jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.record_flashcard_review(uuid, text, timestamptz, jsonb) to authenticated;
revoke all on function public.submit_mock_exam(uuid, jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.submit_mock_exam(uuid, jsonb) to authenticated;
revoke all on function public.move_review_material_to_folder(uuid, uuid) from PUBLIC, anon, authenticated;
grant execute on function public.move_review_material_to_folder(uuid, uuid) to authenticated;

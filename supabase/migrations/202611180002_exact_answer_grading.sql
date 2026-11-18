-- Avoid accepting incomplete or contradictory typed answers as correct.
-- Existing attempts and submitted exams are not regraded.

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

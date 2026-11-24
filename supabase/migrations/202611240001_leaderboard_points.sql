-- Track leaderboard points separately from level XP.
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  practice_item_ids uuid[] not null,
  total_questions integer not null check (total_questions > 0),
  completed_at timestamptz,
  score integer check (score between 0 and 100),
  bonus_awarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.attempts
  add column if not exists session_id uuid references public.practice_sessions(id) on delete set null;

create index if not exists attempts_session_id_idx on public.attempts(session_id);
create index if not exists practice_sessions_user_created_idx on public.practice_sessions(user_id, created_at desc);

create table if not exists public.leaderboard_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points > 0),
  source text not null check (source in ('correct_answer', 'practice_bonus')),
  attempt_id uuid,
  practice_session_id uuid references public.practice_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (source = 'correct_answer' and attempt_id is not null and practice_session_id is null)
    or (source = 'practice_bonus' and attempt_id is null and practice_session_id is not null and points = 20)
  )
);

create unique index if not exists leaderboard_points_attempt_idx
  on public.leaderboard_points(attempt_id) where attempt_id is not null;
create unique index if not exists leaderboard_points_session_bonus_idx
  on public.leaderboard_points(practice_session_id) where source = 'practice_bonus';
create index if not exists leaderboard_points_created_user_idx
  on public.leaderboard_points(created_at, user_id);

alter table public.practice_sessions enable row level security;
alter table public.leaderboard_points enable row level security;
revoke all on public.practice_sessions, public.leaderboard_points from PUBLIC, anon, authenticated;
revoke insert, update, delete on public.attempts from PUBLIC, anon, authenticated;
grant select on public.attempts to authenticated;

create or replace function public.start_practice_session(p_practice_item_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
  v_type_count integer;
  v_subject_count integer;
  v_type text;
  v_subject text;
  v_session_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_practice_item_ids is null or cardinality(p_practice_item_ids) = 0 or cardinality(p_practice_item_ids) > 1000 then
    raise exception 'Practice session items are invalid.';
  end if;
  if cardinality(p_practice_item_ids) <> (
    select count(distinct input.item_id) from unnest(p_practice_item_ids) as input(item_id)
  ) then
    raise exception 'Practice session contains duplicate items.';
  end if;

  select count(*), count(distinct i.type), count(distinct i.subject), min(i.type), min(i.subject)
  into v_total, v_type_count, v_subject_count, v_type, v_subject
  from public.practice_items i
  where i.user_id = v_user_id and i.id = any(p_practice_item_ids);

  if v_total <> cardinality(p_practice_item_ids)
    or v_type_count <> 1
    or v_subject_count <> 1
    or v_type not in ('mcq', 'identification', 'enumeration') then
    raise exception 'Practice session must contain your questions from one eligible study mode and subject.';
  end if;

  insert into public.practice_sessions(user_id, practice_item_ids, total_questions)
  values (v_user_id, p_practice_item_ids, v_total)
  returning id into v_session_id;
  return v_session_id;
end;
$$;

create or replace function public.complete_practice_session(p_session_id uuid)
returns table(score integer, bonus_awarded boolean, points_awarded integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.practice_sessions%rowtype;
  v_answered integer;
  v_correct integer;
  v_score integer;
  v_bonus boolean;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select s.* into v_session
  from public.practice_sessions s
  where s.id = p_session_id and s.user_id = v_user_id
  for update;
  if not found then raise exception 'Practice session not found.'; end if;

  if v_session.completed_at is not null then
    return query select v_session.score, v_session.bonus_awarded,
      case when v_session.bonus_awarded then 20 else 0 end;
    return;
  end if;

  select count(latest.practice_item_id),
    count(*) filter (where latest.is_correct)
  into v_answered, v_correct
  from unnest(v_session.practice_item_ids) expected(practice_item_id)
  left join lateral (
    select a.practice_item_id, a.is_correct
    from public.attempts a
    where a.user_id = v_user_id
      and a.session_id = v_session.id
      and a.practice_item_id = expected.practice_item_id
    order by a.created_at desc, a.id desc
    limit 1
  ) latest on true;

  if v_answered <> v_session.total_questions then
    raise exception 'Answer every question in the practice set before completing it.';
  end if;

  v_score := round(v_correct * 100.0 / v_session.total_questions)::integer;
  v_bonus := v_score >= 75;
  update public.practice_sessions
  set completed_at = now(), score = v_score, bonus_awarded = v_bonus
  where id = v_session.id;

  if v_bonus then
    insert into public.leaderboard_points(user_id, points, source, practice_session_id)
    values (v_user_id, 20, 'practice_bonus', v_session.id)
    on conflict (practice_session_id) where source = 'practice_bonus' do nothing;
  end if;

  return query select v_score, v_bonus, case when v_bonus then 20 else 0 end;
end;
$$;

drop function if exists public.record_practice_attempt(uuid, jsonb, uuid);
drop function if exists public.record_practice_attempt(uuid, jsonb);
create function public.record_practice_attempt(
  p_practice_item_id uuid,
  p_response jsonb,
  p_session_id uuid default null
)
returns table(is_correct boolean, previous_level integer, level integer, points_awarded integer)
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
  v_attempt_id uuid;
  v_points_awarded integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select i.* into v_item
  from public.practice_items i
  where i.id = p_practice_item_id and i.user_id = v_user_id
  for update;
  if not found then raise exception 'Practice item not found.'; end if;

  if p_session_id is not null then
    if v_item.type not in ('mcq', 'identification', 'enumeration') then
      raise exception 'Practice session is invalid or already complete.';
    end if;
    perform 1 from public.practice_sessions s
    where s.id = p_session_id and s.user_id = v_user_id
      and s.completed_at is null and p_practice_item_id = any(s.practice_item_ids)
    for update;
    if not found then
      raise exception 'Practice session is invalid or already complete.';
    end if;
  end if;

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
          and v_user_text = public.normalize_answer_text(candidate.value)
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
        select 1 from jsonb_array_elements_text(v_item.answer->'items') expected_part(value)
        where public.normalize_answer_text(expected_part.value) <> ''
          and public.normalize_answer_text(user_part.value) = public.normalize_answer_text(expected_part.value)
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
    user_id, practice_item_id, board_program, subject, type, user_response, is_correct, session_id
  ) values (
    v_user_id, v_item.id, v_item.board_program, v_item.subject, v_item.type, p_response, v_correct, p_session_id
  ) returning id into v_attempt_id;

  if v_correct and v_item.type in ('mcq', 'identification', 'enumeration') then
    insert into public.leaderboard_points(user_id, points, source, attempt_id)
    values (v_user_id, 10, 'correct_answer', v_attempt_id)
    on conflict (attempt_id) where attempt_id is not null do nothing;
    if found then v_points_awarded := 10; end if;
  end if;

  return query
  select v_correct, progress.previous_level, progress.level, v_points_awarded
  from public.update_my_profile_progress(case when v_correct then 1 else 0 end, 1) progress;
end;
$$;

create or replace function public.record_game_mcq_attempt(p_practice_item_id uuid, p_selected integer)
returns table(is_correct boolean, points_awarded integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.practice_items%rowtype;
  v_correct boolean;
  v_attempt_id uuid;
  v_points_awarded integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_selected < 0 then raise exception 'Selected answer is invalid.'; end if;

  select i.* into v_item
  from public.practice_items i
  where i.id = p_practice_item_id and i.user_id = v_user_id and i.type = 'mcq'
  for update;
  if not found then raise exception 'Multiple-choice question not found.'; end if;

  v_correct := p_selected is not null and p_selected::text = v_item.answer->>'correctIndex';
  insert into public.attempts(
    user_id, practice_item_id, board_program, subject, type, user_response, is_correct
  ) values (
    v_user_id, v_item.id, v_item.board_program, v_item.subject, v_item.type,
    jsonb_build_object('selected', p_selected), v_correct
  ) returning id into v_attempt_id;

  if v_correct then
    insert into public.leaderboard_points(user_id, points, source, attempt_id)
    values (v_user_id, 10, 'correct_answer', v_attempt_id);
    v_points_awarded := 10;
  end if;

  return query select v_correct, v_points_awarded;
end;
$$;

drop function if exists public.submit_mock_exam(uuid, jsonb);
create function public.submit_mock_exam(p_exam_id uuid, p_answers jsonb)
returns table(score numeric, passed boolean, previous_level integer, level integer, points_awarded integer)
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
  v_expected_count integer;
  v_matched_count integer;
  v_input_count integer;
  v_distinct_input_count integer;
  v_attempt_id uuid;
  v_points_awarded integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answers must be provided as an array.';
  end if;

  select e.* into v_exam
  from public.mock_exams e
  where e.id = p_exam_id and e.user_id = v_user_id
  for update;
  if not found then raise exception 'Mock exam not found.'; end if;
  if v_exam.status = 'submitted' then
    select coalesce(p.level, 1) into v_level from public.profiles p where p.id = v_user_id;
    return query select v_exam.score, v_exam.passed, v_level, v_level, v_points_awarded;
    return;
  end if;
  if v_exam.status <> 'in_progress' then raise exception 'Mock exam has already been submitted.'; end if;

  select count(*) into v_total from public.mock_exam_items i where i.exam_id = p_exam_id;
  select count(*) into v_answer_count from jsonb_array_elements(p_answers);
  if v_total = 0 or v_answer_count <> v_total or v_total <> v_exam.total_items then
    raise exception 'The answer list does not match the exam.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_answers) as a(answer)
    group by a.answer->>'item_id' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_answers) as a(answer)
    where a.answer->>'item_id' is null
       or not exists (
         select 1 from public.mock_exam_items i
         where i.exam_id = p_exam_id and i.id::text = a.answer->>'item_id'
       )
  ) then
    raise exception 'The answer list contains duplicate or unknown exam items.';
  end if;

  for v_item in
    select i.* from public.mock_exam_items i where i.exam_id = p_exam_id order by i.position
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
          select 1 from jsonb_array_elements_text(
            jsonb_build_array(v_item.answer->'expected')
              || coalesce(v_item.answer->'acceptable', '[]'::jsonb)
          ) candidate(value)
          where public.normalize_answer_text(candidate.value) <> ''
            and v_user_text = public.normalize_answer_text(candidate.value)
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
    elsif v_item.type = 'enumeration' then
      v_user_text := coalesce(v_response->>'text', '');
      select count(*) into v_expected_count from jsonb_array_elements_text(v_item.answer->'items');
      select count(*) into v_matched_count
      from regexp_split_to_table(v_user_text, E'[\\n,;]+') user_part(value)
      where public.normalize_answer_text(user_part.value) <> ''
        and exists (
          select 1 from jsonb_array_elements_text(v_item.answer->'items') expected_part(value)
          where public.normalize_answer_text(expected_part.value) <> ''
            and public.normalize_answer_text(user_part.value) = public.normalize_answer_text(expected_part.value)
        );
      select count(*), count(distinct public.normalize_answer_text(user_part.value))
      into v_input_count, v_distinct_input_count
      from regexp_split_to_table(v_user_text, E'[\\n,;]+') user_part(value)
      where public.normalize_answer_text(user_part.value) <> '';
      v_correct := v_expected_count > 0 and v_matched_count = v_expected_count
        and v_input_count = v_expected_count and v_distinct_input_count = v_expected_count;
    end if;

    update public.mock_exam_items i
    set user_response = v_response, is_correct = v_correct
    where i.id = v_item.id;
    insert into public.attempts (
      user_id, practice_item_id, board_program, subject, type, user_response, is_correct
    ) values (
      v_user_id, v_item.practice_item_id, v_exam.board_program, v_item.subject,
      v_item.type, v_response, v_correct
    ) returning id into v_attempt_id;

    if v_correct then
      v_correct_count := v_correct_count + 1;
      if v_item.type in ('mcq', 'identification', 'enumeration') then
        insert into public.leaderboard_points(user_id, points, source, attempt_id)
        values (v_user_id, 10, 'correct_answer', v_attempt_id)
        on conflict (attempt_id) where attempt_id is not null do nothing;
        if found then v_points_awarded := v_points_awarded + 10; end if;
      end if;
    end if;
  end loop;

  v_score := round(v_correct_count * 1000.0 / v_total) / 10;
  select coalesce(bool_and(subject_correct * 2 >= subject_total), true)
  into v_subjects_pass
  from (
    select i.subject, count(*) as subject_total,
      count(*) filter (where i.is_correct) as subject_correct
    from public.mock_exam_items i
    where i.exam_id = p_exam_id group by i.subject
  ) subject_scores;
  v_passed := v_score >= 75 and v_subjects_pass;

  update public.mock_exams e
  set status = 'submitted', submitted_at = now(), score = v_score, passed = v_passed
  where e.id = p_exam_id;

  select p.previous_level, p.level into v_previous_level, v_level
  from public.update_my_profile_progress(v_correct_count, v_total) p;
  return query select v_score, v_passed, v_previous_level, v_level, v_points_awarded;
end;
$$;

create or replace function public.get_leaderboard(p_period text)
returns table(
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_path text,
  avatar_border text,
  level integer,
  points bigint,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_period not in ('week', 'month') then raise exception 'Leaderboard period must be week or month.'; end if;

  if p_period = 'week' then
    v_period_start := date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
    v_period_end := v_period_start + interval '1 week';
  else
    v_period_start := date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
    v_period_end := v_period_start + interval '1 month';
  end if;

  return query
  with totals as (
    select p.id as user_id, coalesce(nullif(trim(p.full_name), ''), 'Pharmora Student') as display_name,
      p.avatar_id, p.avatar_path, p.avatar_border, coalesce(p.level, 1) as level,
      sum(lp.points)::bigint as points
    from public.profiles p
    join public.leaderboard_points lp on lp.user_id = p.id
      and lp.created_at >= v_period_start and lp.created_at < v_period_end
    group by p.id
  ),
  ranked as (
    select row_number() over (order by t.points desc, t.user_id) as rank, t.*
    from totals t
  ),
  visible as (
    select r.rank, r.user_id, r.display_name, r.avatar_id, r.avatar_path, r.avatar_border,
      r.level, r.points, r.user_id = v_user_id as is_current_user
    from ranked r
    where r.rank <= 50 or r.user_id = v_user_id
    union all
    select null::bigint, p.id, coalesce(nullif(trim(p.full_name), ''), 'Pharmora Student'),
      p.avatar_id, p.avatar_path, p.avatar_border, coalesce(p.level, 1), 0::bigint, true
    from public.profiles p
    where p.id = v_user_id and not exists (select 1 from ranked r where r.user_id = v_user_id)
  )
  select v.rank, v.user_id, v.display_name, v.avatar_id, v.avatar_path, v.avatar_border,
    v.level, v.points, v.is_current_user
  from visible v
  order by v.rank nulls last, v.points desc, v.user_id;
end;
$$;

revoke all on function public.start_practice_session(uuid[]) from PUBLIC, anon, authenticated;
grant execute on function public.start_practice_session(uuid[]) to authenticated;
revoke all on function public.complete_practice_session(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.complete_practice_session(uuid) to authenticated;
revoke all on function public.record_practice_attempt(uuid, jsonb, uuid) from PUBLIC, anon, authenticated;
grant execute on function public.record_practice_attempt(uuid, jsonb, uuid) to authenticated;
revoke all on function public.record_game_mcq_attempt(uuid, integer) from PUBLIC, anon, authenticated;
grant execute on function public.record_game_mcq_attempt(uuid, integer) to authenticated;
revoke all on function public.submit_mock_exam(uuid, jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.submit_mock_exam(uuid, jsonb) to authenticated;
revoke all on function public.get_leaderboard(text) from PUBLIC, anon, authenticated;
grant execute on function public.get_leaderboard(text) to authenticated;

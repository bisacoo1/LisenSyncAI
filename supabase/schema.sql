-- Pharmora AI: consolidated Supabase setup for one-shot SQL Editor execution.
-- Includes the current schema and all changes from supabase/migrations.
-- Keep this file updated whenever a new migration is added.
-- Enable extensions
create extension if not exists "pgcrypto";

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_id text not null default 'initials',
  avatar_path text,
  avatar_border text not null default 'default-circle',
  board_program text not null,
  target_exam_date date,
  xp integer default 0,
  level integer default 1,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_activity_date date,
  daily_goal integer default 20,
  daily_items_completed integer default 0,
  daily_goal_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Columns added after initial release; safe to re-run on existing databases
alter table public.profiles
  add column if not exists xp integer default 0,
  add column if not exists level integer default 1,
  add column if not exists current_streak integer default 0,
  add column if not exists longest_streak integer default 0,
  add column if not exists last_activity_date date,
  add column if not exists daily_goal integer default 20,
  add column if not exists daily_items_completed integer default 0,
  add column if not exists daily_goal_date date,
  add column if not exists avatar_id text not null default 'initials',
  add column if not exists avatar_path text,
  add column if not exists avatar_border text not null default 'default-circle',
  add column if not exists track text not null default 'board';

-- Review materials uploaded by users
create table if not exists public.review_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  board_program text not null,
  subject text not null,
  subject_folder_id uuid,
  source_filename text,
  file_uri text,
  mime_type text,
  file_size bigint,
  extracted_text text,
  created_at timestamptz default now()
);

-- Columns added after initial release; safe to re-run on existing databases
alter table public.review_materials
  add column if not exists extracted_text text;

-- Flashcards generated from materials
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.review_materials(id) on delete set null,
  board_program text not null,
  subject text not null,
  front text not null,
  back text not null,
  created_at timestamptz default now()
);

-- Custom subjects for students still taking the course (course track).
-- Subjects are created from the names users give their uploaded reviewers.
create table if not exists public.user_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

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

create index if not exists idx_user_subjects_user on public.user_subjects(user_id);

alter table public.user_subjects enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subjects' AND policyname = 'user_subjects_owner') THEN
    CREATE POLICY "user_subjects_owner" ON public.user_subjects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Practice/assessment items (MCQ, diagnosis, sequence) and mock exam questions
create table if not exists public.practice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.review_materials(id) on delete set null,
  board_program text not null,
  subject text not null,
  type text not null check (type in ('mcq', 'diagnosis', 'sequence', 'flashcard_drill')),
  question jsonb not null,
  answer jsonb not null,
  rationale text,
  difficulty text default 'board',
  created_at timestamptz default now()
);

-- Add course-mode practice types for both fresh and existing Supabase projects.
alter table public.practice_items
  drop constraint if exists practice_items_type_check;

alter table public.practice_items
  add constraint practice_items_type_check
  check (type in ('mcq', 'diagnosis', 'sequence', 'flashcard_drill', 'enumeration', 'identification'));

alter table public.practice_items
  add column if not exists hint text;

-- Mock exam definitions/attempts
create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_program text not null,
  title text not null,
  duration_minutes int not null default 240,
  tos jsonb,
  total_items int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at timestamptz default now(),
  submitted_at timestamptz,
  score numeric,
  passed boolean
);

create table if not exists public.mock_exam_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.mock_exams(id) on delete cascade,
  practice_item_id uuid references public.practice_items(id) on delete set null,
  subject text not null,
  type text not null,
  question jsonb not null,
  answer jsonb not null,
  rationale text,
  user_response jsonb,
  is_correct boolean,
  position int not null default 0
);

-- Attempts for practice (non-mock) and remediation tracking
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_item_id uuid references public.practice_items(id) on delete cascade,
  board_program text not null,
  subject text not null,
  type text not null,
  user_response jsonb,
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.review_materials enable row level security;
alter table public.flashcards enable row level security;
alter table public.practice_items enable row level security;
alter table public.mock_exams enable row level security;
alter table public.mock_exam_items enable row level security;
alter table public.attempts enable row level security;

-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own') THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Generic owner policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_materials' AND policyname = 'materials_owner') THEN
    CREATE POLICY "materials_owner" ON public.review_materials FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'flashcards' AND policyname = 'flashcards_owner') THEN
    CREATE POLICY "flashcards_owner" ON public.flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_items' AND policyname = 'practice_items_owner') THEN
    CREATE POLICY "practice_items_owner" ON public.practice_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mock_exams' AND policyname = 'mock_exams_owner') THEN
    CREATE POLICY "mock_exams_owner" ON public.mock_exams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attempts' AND policyname = 'attempts_owner') THEN
    CREATE POLICY "attempts_owner" ON public.attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- mock_exam_items: access via owning exam
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mock_exam_items' AND policyname = 'mock_exam_items_owner') THEN
    CREATE POLICY "mock_exam_items_owner" ON public.mock_exam_items FOR ALL
    USING (EXISTS (SELECT 1 FROM public.mock_exams e WHERE e.id = exam_id AND e.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.mock_exams e WHERE e.id = exam_id AND e.user_id = auth.uid()));
  END IF;
END $$;

-- Document highlights & AI explanations (Side by Side reader)
create table if not exists public.document_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.review_materials(id) on delete cascade,
  selected_text text not null,
  explanation text,
  ai_model text,
  created_at timestamptz default now()
);

create index if not exists idx_document_highlights_material on public.document_highlights(material_id);
create index if not exists idx_document_highlights_user on public.document_highlights(user_id);

-- Spaced repetition scheduling for flashcards (SM-2 style)
alter table public.flashcards
  add column if not exists hint text,
  add column if not exists ease_factor numeric not null default 2.5,
  add column if not exists interval_minutes integer not null default 0,
  add column if not exists repetitions integer not null default 0,
  add column if not exists next_review_at timestamptz not null default now(),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_quality integer;

create index if not exists idx_flashcards_user_review on public.flashcards(user_id, next_review_at);

-- Row Level Security
alter table public.document_highlights enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_highlights' AND policyname = 'highlights_owner') THEN
    CREATE POLICY "highlights_owner" ON public.document_highlights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Private bucket for reviewer uploads. Objects live at {user_id}/{file_id}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-materials',
  'review-materials',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'review_materials_select_own') THEN
    CREATE POLICY "review_materials_select_own" ON storage.objects FOR SELECT
    USING (bucket_id = 'review-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'review_materials_insert_own') THEN
    CREATE POLICY "review_materials_insert_own" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'review-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'review_materials_delete_own') THEN
    CREATE POLICY "review_materials_delete_own" ON storage.objects FOR DELETE
    USING (bucket_id = 'review-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Private bucket for profile photos. Objects live at {user_id}/{file_id}.{extension}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_select_own') THEN
    CREATE POLICY "profile_avatars_select_own" ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_insert_own') THEN
    CREATE POLICY "profile_avatars_insert_own" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_delete_own') THEN
    CREATE POLICY "profile_avatars_delete_own" ON storage.objects FOR DELETE
    USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Atomic progress updates, mock submissions, and subject-folder moves.
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
  v_current_xp integer;
  v_new_xp integer;
  v_remaining_xp integer;
  v_level_xp integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_total is null or p_correct is null
    or p_total < 1 or p_total > 10000 or p_correct < 0 or p_correct > p_total then
    raise exception 'Progress values are invalid.';
  end if;

  select coalesce(p.level, 1), coalesce(p.xp, 0)
  into v_previous_level, v_current_xp
  from public.profiles p where p.id = v_user_id for update;
  if not found then raise exception 'Profile not found.'; end if;

  select case
    when p.last_activity_date = v_today then coalesce(p.current_streak, 0)
    when p.last_activity_date = v_today - 1 then coalesce(p.current_streak, 0) + 1
    else 1
  end into v_current_streak
  from public.profiles p where p.id = v_user_id;

  v_xp_gain := p_correct * 10 + (p_total - p_correct) * 2;
  v_new_xp := v_current_xp + v_xp_gain;
  v_remaining_xp := v_new_xp;
  v_level := 1;
  v_level_xp := 100;
  while v_remaining_xp >= v_level_xp loop
    v_remaining_xp := v_remaining_xp - v_level_xp;
    v_level := v_level + 1;
    v_level_xp := v_level * 100;
  end loop;

  update public.profiles p
  set xp = v_new_xp,
      level = v_level,
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

update public.profiles
set level = floor((1 + sqrt(1 + 8 * greatest(coalesce(xp, 0), 0)::numeric / 100)) / 2)::integer;

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

drop function if exists public.submit_mock_exam(uuid, jsonb);
create function public.submit_mock_exam(p_exam_id uuid, p_answers jsonb)
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
    select coalesce(p.level, 1) into v_level
    from public.profiles p where p.id = v_user_id;
    return query select v_exam.score, v_exam.passed, v_level, v_level;
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
    select i.* from public.mock_exam_items i
    where i.exam_id = p_exam_id order by i.position
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
    if v_correct then v_correct_count := v_correct_count + 1; end if;
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
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (
    select 1 from public.user_subjects s
    where s.id = p_folder_id and s.user_id = v_user_id
  ) then raise exception 'Subject folder not found.'; end if;

  update public.review_materials m
  set subject_folder_id = p_folder_id
  where m.id = p_material_id and m.user_id = v_user_id;
  if not found then raise exception 'Reviewer not found.'; end if;
end;
$$;

create or replace function public.rename_review_material(p_material_id uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := nullif(trim(p_title), '');
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_title is null then raise exception 'A deck title is required.'; end if;

  update public.review_materials
  set title = v_title
  where id = p_material_id and user_id = v_user_id;
  if not found then raise exception 'Reviewer not found.'; end if;

  return v_title;
end;
$$;

create or replace function public.update_review_practice_item(
  p_item_id uuid,
  p_material_id uuid,
  p_question jsonb,
  p_answer jsonb,
  p_hint text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_question is null or p_answer is null then raise exception 'A question and answer are required.'; end if;

  update public.practice_items
  set question = p_question,
      answer = p_answer,
      hint = nullif(trim(p_hint), '')
  where id = p_item_id
    and material_id = p_material_id
    and user_id = v_user_id;
  if not found then raise exception 'Study question not found.'; end if;

  delete from public.attempts
  where practice_item_id = p_item_id and user_id = v_user_id;
end;
$$;

create or replace function public.delete_review_material(p_material_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_uri text;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select file_uri into v_file_uri
  from public.review_materials
  where id = p_material_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Reviewer not found.'; end if;

  delete from public.flashcards
  where user_id = v_user_id and material_id = p_material_id;
  delete from public.practice_items
  where user_id = v_user_id and material_id = p_material_id;
  delete from public.review_materials
  where id = p_material_id and user_id = v_user_id;

  return v_file_uri;
end;
$$;

create or replace function public.delete_subject_folder_contents(p_folder_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_folder_name text;
  v_material_ids uuid[];
  v_file_uris text[];
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select name into v_folder_name
  from public.user_subjects
  where id = p_folder_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Subject folder not found.'; end if;

  select
    coalesce(array_agg(m.id), array[]::uuid[]),
    coalesce(array_agg(distinct m.file_uri) filter (where m.file_uri is not null), array[]::text[])
  into v_material_ids, v_file_uris
  from public.review_materials m
  where m.user_id = v_user_id
    and (m.subject_folder_id = p_folder_id or (m.subject_folder_id is null and m.subject = v_folder_name));

  delete from public.flashcards
  where user_id = v_user_id and material_id = any(v_material_ids);
  delete from public.practice_items
  where user_id = v_user_id and material_id = any(v_material_ids);
  delete from public.review_materials
  where user_id = v_user_id and id = any(v_material_ids);
  delete from public.user_subjects
  where id = p_folder_id and user_id = v_user_id;

  return v_file_uris;
end;
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, update on public.profiles from PUBLIC, anon, authenticated;
grant insert (id, full_name, board_program, target_exam_date, track, updated_at)
  on public.profiles to authenticated;
grant update (id, full_name, avatar_id, avatar_path, avatar_border, board_program, target_exam_date, track, updated_at)
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
revoke all on function public.rename_review_material(uuid, text) from PUBLIC, anon, authenticated;
grant execute on function public.rename_review_material(uuid, text) to authenticated;
revoke all on function public.update_review_practice_item(uuid, uuid, jsonb, jsonb, text) from PUBLIC, anon, authenticated;
grant execute on function public.update_review_practice_item(uuid, uuid, jsonb, jsonb, text) to authenticated;
revoke all on function public.delete_review_material(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.delete_review_material(uuid) to authenticated;
revoke all on function public.delete_subject_folder_contents(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.delete_subject_folder_contents(uuid) to authenticated;


-- Synced from migrations/202611240001_leaderboard_points.sql
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
-- Synced from migrations/202611240002_profiles_friends_reviewer_sharing.sql
-- Add public learner summaries, mutual friends, and generated reviewer copies.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair_idx
  on public.friendships(least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_status_idx on public.friendships(requester_id, status);
create index if not exists friendships_addressee_status_idx on public.friendships(addressee_id, status);

create table if not exists public.reviewer_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  source_material_id uuid not null references public.review_materials(id) on delete cascade,
  recipient_material_id uuid not null references public.review_materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (source_material_id, recipient_id)
);

alter table public.friendships enable row level security;
alter table public.reviewer_shares enable row level security;
revoke all on public.friendships, public.reviewer_shares from PUBLIC, anon, authenticated;

create or replace function public.get_public_learner_profile(p_learner_id uuid)
returns table(
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_path text,
  avatar_border text,
  level integer,
  subjects_count integer,
  practice_accuracy numeric,
  total_attempts integer,
  friendship_id uuid,
  friendship_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_friendship_id uuid;
  v_friendship_status text := 'none';
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_learner_id) then
    raise exception 'Learner profile not found.';
  end if;

  if p_learner_id = v_user_id then
    v_friendship_status := 'self';
  else
    select f.id,
      case when f.status = 'accepted' then 'friends'
        when f.requester_id = v_user_id then 'outgoing_pending'
        else 'incoming_pending'
      end
    into v_friendship_id, v_friendship_status
    from public.friendships f
    where (f.requester_id = v_user_id and f.addressee_id = p_learner_id)
      or (f.requester_id = p_learner_id and f.addressee_id = v_user_id);
    if not found then v_friendship_status := 'none'; end if;
  end if;

  return query
  select p.id,
    coalesce(nullif(trim(p.full_name), ''), 'Pharmora Student'),
    p.avatar_id, p.avatar_path, p.avatar_border, coalesce(p.level, 1),
    coalesce(subjects.subjects_count, 0),
    case when coalesce(attempts.total_attempts, 0) = 0 then 0::numeric
      else round(attempts.correct_attempts * 100.0 / attempts.total_attempts, 1)
    end,
    coalesce(attempts.total_attempts, 0),
    v_friendship_id, v_friendship_status
  from public.profiles p
  left join lateral (
    select count(*)::integer as total_attempts,
      (count(*) filter (where a.is_correct))::integer as correct_attempts
    from public.attempts a
    where a.user_id = p.id
  ) attempts on true
  left join lateral (
    select count(*)::integer as subjects_count
    from (
      select coalesce(s.name, m.subject) as subject_name
      from public.review_materials m
      left join public.user_subjects s
        on s.id = m.subject_folder_id and s.user_id = p.id
      where m.user_id = p.id
      union
      select s.name
      from public.user_subjects s
      where s.user_id = p.id
    ) learner_subjects
  ) subjects on true
  where p.id = p_learner_id;
end;
$$;

create or replace function public.search_public_learners(p_query text)
returns table(
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_path text,
  avatar_border text,
  level integer,
  friendship_id uuid,
  friendship_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := lower(trim(coalesce(p_query, '')));
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if length(v_query) < 2 then raise exception 'Enter at least 2 characters to search.'; end if;
  if length(v_query) > 80 then raise exception 'Search query is too long.'; end if;

  return query
  select p.id,
    coalesce(nullif(trim(p.full_name), ''), 'Pharmora Student'),
    p.avatar_id, p.avatar_path, p.avatar_border, coalesce(p.level, 1),
    f.id,
    case
      when f.id is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requester_id = v_user_id then 'outgoing_pending'
      else 'incoming_pending'
    end
  from public.profiles p
  left join public.friendships f
    on (f.requester_id = v_user_id and f.addressee_id = p.id)
    or (f.requester_id = p.id and f.addressee_id = v_user_id)
  where p.id <> v_user_id
    and (
      strpos(lower(coalesce(p.full_name, '')), v_query) > 0
      or (
        length(v_query) >= 6
        and v_query ~ '^[0-9a-f-]+$'
        and left(p.id::text, length(v_query)) = v_query
      )
    )
  order by
    case when lower(trim(coalesce(p.full_name, ''))) = v_query then 0 else 1 end,
    lower(coalesce(p.full_name, '')),
    p.id
  limit 20;
end;
$$;

create or replace function public.get_friend_connections()
returns table(
  friendship_id uuid,
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_path text,
  avatar_border text,
  level integer,
  status text,
  direction text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  return query
  select f.id,
    p.id,
    coalesce(nullif(trim(p.full_name), ''), 'Pharmora Student'),
    p.avatar_id, p.avatar_path, p.avatar_border, coalesce(p.level, 1),
    f.status,
    case when f.status = 'accepted' then 'friend'
      when f.requester_id = v_user_id then 'outgoing'
      else 'incoming'
    end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end
  where f.requester_id = v_user_id or f.addressee_id = v_user_id
  order by case when f.status = 'pending' and f.addressee_id = v_user_id then 0
    when f.status = 'pending' then 1 else 2 end,
    lower(coalesce(p.full_name, ''));
end;
$$;

create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_requester uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_user_id is null or p_user_id = v_user_id then raise exception 'Choose another learner to add.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Learner profile not found.';
  end if;

  insert into public.friendships(requester_id, addressee_id)
  values (v_user_id, p_user_id)
  on conflict do nothing;

  select f.requester_id, f.status into v_requester, v_status
  from public.friendships f
  where (f.requester_id = v_user_id and f.addressee_id = p_user_id)
    or (f.requester_id = p_user_id and f.addressee_id = v_user_id);
  if not found then raise exception 'Friend request could not be created.'; end if;
  if v_status = 'accepted' then return 'friends'; end if;
  return case when v_requester = v_user_id then 'outgoing_pending' else 'incoming_pending' end;
end;
$$;

create or replace function public.accept_friend_request(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  update public.friendships f
  set status = 'accepted', updated_at = now()
  where f.id = p_friendship_id and f.addressee_id = v_user_id and f.status = 'pending';
  if not found then raise exception 'Friend request not found or already handled.'; end if;
end;
$$;

create or replace function public.remove_friend_connection(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  delete from public.friendships f
  where f.id = p_friendship_id
    and (f.requester_id = v_user_id or f.addressee_id = v_user_id);
  if not found then raise exception 'Friend connection not found.'; end if;
end;
$$;

create or replace function public.share_reviewer_with_friend(p_material_id uuid, p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.review_materials%rowtype;
  v_folder_name text;
  v_folder_id uuid;
  v_recipient_material_id uuid;
  v_existing_material_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_friend_id is null or p_friend_id = v_user_id then raise exception 'Choose a friend to share with.'; end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_user_id and f.addressee_id = p_friend_id)
        or (f.requester_id = p_friend_id and f.addressee_id = v_user_id))
  ) then
    raise exception 'Reviewer sharing is available only between accepted friends.';
  end if;

  select m.* into v_source
  from public.review_materials m
  where m.id = p_material_id and m.user_id = v_user_id
  for update;
  if not found then raise exception 'Reviewer not found.'; end if;
  if not exists (
    select 1 from public.practice_items i
    where i.user_id = v_user_id and i.material_id = v_source.id
  ) and not exists (
    select 1 from public.flashcards c
    where c.user_id = v_user_id and c.material_id = v_source.id
  ) then
    raise exception 'Generate at least one study set before sharing this reviewer.';
  end if;

  select s.recipient_material_id into v_existing_material_id
  from public.reviewer_shares s
  where s.source_material_id = p_material_id and s.recipient_id = p_friend_id;
  if found then return v_existing_material_id; end if;

  select s.name into v_folder_name
  from public.user_subjects s
  where s.id = v_source.subject_folder_id and s.user_id = v_user_id;
  v_folder_name := coalesce(v_folder_name, v_source.subject);

  insert into public.user_subjects(user_id, name)
  values (p_friend_id, v_folder_name)
  on conflict (user_id, name) do update set name = excluded.name
  returning id into v_folder_id;

  insert into public.review_materials(
    user_id, title, board_program, subject, subject_folder_id,
    source_filename, file_uri, mime_type, file_size, extracted_text
  ) values (
    p_friend_id, v_source.title, v_source.board_program, v_source.subject, v_folder_id,
    null, null, null, null, null
  ) returning id into v_recipient_material_id;

  insert into public.practice_items(
    user_id, material_id, board_program, subject, type, question, answer, rationale, difficulty
  )
  select p_friend_id, v_recipient_material_id, i.board_program, i.subject,
    i.type, i.question, i.answer, i.rationale, i.difficulty
  from public.practice_items i
  where i.user_id = v_user_id and i.material_id = v_source.id;

  insert into public.flashcards(user_id, material_id, board_program, subject, front, back)
  select p_friend_id, v_recipient_material_id, c.board_program, c.subject, c.front, c.back
  from public.flashcards c
  where c.user_id = v_user_id and c.material_id = v_source.id;

  insert into public.reviewer_shares(
    sender_id, recipient_id, source_material_id, recipient_material_id
  ) values (
    v_user_id, p_friend_id, v_source.id, v_recipient_material_id
  );

  return v_recipient_material_id;
end;
$$;

create or replace function public.share_reviewers_with_friend(p_material_ids uuid[], p_friend_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_material_id uuid;
  v_shared_count integer := 0;
begin
  if p_material_ids is null or coalesce(cardinality(p_material_ids), 0) = 0 then
    raise exception 'Choose at least one reviewer to share.';
  end if;
  if cardinality(p_material_ids) <> (
    select count(distinct item_id) from unnest(p_material_ids) as requested(item_id)
  ) then
    raise exception 'The reviewer list contains duplicates.';
  end if;

  for v_material_id in
    select item_id from unnest(p_material_ids) as requested(item_id)
  loop
    perform public.share_reviewer_with_friend(v_material_id, p_friend_id);
    v_shared_count := v_shared_count + 1;
  end loop;

  return v_shared_count;
end;
$$;

revoke all on function public.get_public_learner_profile(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.get_public_learner_profile(uuid) to authenticated;
revoke all on function public.search_public_learners(text) from PUBLIC, anon, authenticated;
grant execute on function public.search_public_learners(text) to authenticated;
revoke all on function public.get_friend_connections() from PUBLIC, anon, authenticated;
grant execute on function public.get_friend_connections() to authenticated;
revoke all on function public.send_friend_request(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
revoke all on function public.accept_friend_request(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
revoke all on function public.remove_friend_connection(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.remove_friend_connection(uuid) to authenticated;
revoke all on function public.share_reviewer_with_friend(uuid, uuid) from PUBLIC, anon, authenticated;
grant execute on function public.share_reviewer_with_friend(uuid, uuid) to authenticated;
revoke all on function public.share_reviewers_with_friend(uuid[], uuid) from PUBLIC, anon, authenticated;
grant execute on function public.share_reviewers_with_friend(uuid[], uuid) to authenticated;

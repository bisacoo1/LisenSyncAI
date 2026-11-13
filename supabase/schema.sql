-- LisenSync AI: Supabase schema (run in Supabase SQL editor)
-- Enable extensions
create extension if not exists "pgcrypto";

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
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

-- Review materials uploaded by users
create table if not exists public.review_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  board_program text not null,
  subject text not null,
  source_filename text,
  file_uri text,
  mime_type text,
  file_size bigint,
  extracted_text text,
  created_at timestamptz default now()
);

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
    'application/vnd.ms-powerpoint'
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

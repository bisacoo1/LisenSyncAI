-- LisenSync AI: Supabase schema (run in Supabase SQL editor)
-- Enable extensions
create extension if not exists "pgcrypto";

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  board_program text not null,
  target_exam_date date,
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
create policy if not exists "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy if not exists "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy if not exists "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Generic owner policies
create policy if not exists "materials_owner" on public.review_materials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "flashcards_owner" on public.flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "practice_items_owner" on public.practice_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "mock_exams_owner" on public.mock_exams for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "attempts_owner" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mock_exam_items: access via owning exam
create policy if not exists "mock_exam_items_owner" on public.mock_exam_items for all
using (exists (select 1 from public.mock_exams e where e.id = exam_id and e.user_id = auth.uid()))
with check (exists (select 1 from public.mock_exams e where e.id = exam_id and e.user_id = auth.uid()));

-- Storage: create bucket 'reviewers' in dashboard (private). Example policy (apply via dashboard/storage policies):
-- allow authenticated users to manage files under their uid folder.

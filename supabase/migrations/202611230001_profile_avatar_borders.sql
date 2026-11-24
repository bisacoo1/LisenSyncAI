alter table public.profiles
  add column if not exists avatar_border text not null default 'capsule-specialist';

grant update (id, full_name, avatar_id, avatar_path, avatar_border, board_program, target_exam_date, track, updated_at)
  on public.profiles to authenticated;

alter table public.profiles
  add column if not exists avatar_id text not null default 'initials',
  add column if not exists avatar_path text;

grant update (id, full_name, avatar_id, avatar_path, board_program, target_exam_date, track, updated_at)
  on public.profiles to authenticated;

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

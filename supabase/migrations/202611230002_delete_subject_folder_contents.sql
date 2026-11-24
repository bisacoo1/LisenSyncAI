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
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

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

revoke all on function public.delete_subject_folder_contents(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.delete_subject_folder_contents(uuid) to authenticated;

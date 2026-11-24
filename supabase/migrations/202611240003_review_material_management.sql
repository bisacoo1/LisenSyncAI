alter table public.flashcards
  add column if not exists hint text;

alter table public.practice_items
  add column if not exists hint text;

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

revoke all on function public.rename_review_material(uuid, text) from PUBLIC, anon, authenticated;
grant execute on function public.rename_review_material(uuid, text) to authenticated;
revoke all on function public.update_review_practice_item(uuid, uuid, jsonb, jsonb, text) from PUBLIC, anon, authenticated;
grant execute on function public.update_review_practice_item(uuid, uuid, jsonb, jsonb, text) to authenticated;
revoke all on function public.delete_review_material(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.delete_review_material(uuid) to authenticated;

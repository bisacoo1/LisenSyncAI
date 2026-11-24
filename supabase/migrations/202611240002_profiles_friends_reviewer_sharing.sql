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

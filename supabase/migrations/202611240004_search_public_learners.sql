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

revoke all on function public.search_public_learners(text) from PUBLIC, anon, authenticated;
grant execute on function public.search_public_learners(text) to authenticated;

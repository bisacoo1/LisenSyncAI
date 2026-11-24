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

-- Reel Time 0006: rewards for the "game feel" sprint: catch streaks, the goal ladder, tandem catches
-- and the Fish of the Week. Same rules as before: capped per kind, unique per key, limited per day.
begin;
create or replace function public.claim_reward(p_kind text, p_key text, p_coins int, p_pearls int, p_xp int, p_title text default null, p_item text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public._uid(); p public.profiles;
  cap_c int; cap_p int; cap_x int; per_day int; n_today int;
  c int; pe int; x int; lvl_before int; lvl_after int; v_titles text[];
begin
  -- what each kind can pay out at most, and how many a day
  case p_kind
    when 'quest' then cap_c := 200; cap_p := 0; cap_x := 150; per_day := 3;
    when 'npc' then cap_c := 200; cap_p := 0; cap_x := 100; per_day := 1;
    when 'story' then cap_c := 500; cap_p := 25; cap_x := 300; per_day := 6;
    when 'derby' then cap_c := 250; cap_p := 2; cap_x := 120; per_day := 24;
    when 'festival' then cap_c := 150; cap_p := 2; cap_x := 100; per_day := 1;
    when 'collection' then cap_c := 1500; cap_p := 20; cap_x := 800; per_day := 7;
    when 'tutorial' then cap_c := 50; cap_p := 0; cap_x := 20; per_day := 1;
    when 'streak' then cap_c := 30; cap_p := 0; cap_x := 10; per_day := 40;
    when 'goal' then cap_c := 150; cap_p := 3; cap_x := 100; per_day := 12;
    when 'tandem' then cap_c := 40; cap_p := 0; cap_x := 30; per_day := 20;
    when 'fotw' then cap_c := 120; cap_p := 0; cap_x := 60; per_day := 1;
    else raise exception 'Unknown reward';
  end case;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad reward key'; end if;
  if p_kind = 'story' and p_key not in ('story0', 'story1', 'story2', 'story3', 'story4', 'story5') then raise exception 'Bad story chapter'; end if;
  if p_kind = 'collection' and p_key not in ('cove', 'frost', 'marsh', 'pond', 'river', 'quarry', 'deep') then raise exception 'Bad collection'; end if;
  if p_kind = 'tutorial' and p_key <> 'first' then raise exception 'Bad key'; end if;
  if p_kind = 'goal' and p_key not in ('catch5', 'sell', 'bait', 'baitcatch', 'level3', 'boat', 'frost', 'request', 'gear', 'decor', 'rare', 'collection') then raise exception 'Bad goal'; end if;
  if p_title is not null and p_title not in ('Lantern Keeper', 'Cove Regular', 'Frostpine Regular', 'Marsh Wader', 'Pond Pal', 'River Runner', 'Quarry Diver', 'Deep Legend') then raise exception 'Unknown title'; end if;
  if p_item is not null and p_item not in ('lure_lantern') then raise exception 'Unknown item'; end if;
  if exists (select 1 from public.reward_claims where user_id = u and kind = p_kind and key = p_key) then
    return jsonb_build_object('ok', false, 'reason', 'Already claimed.', 'state', public.get_state());
  end if;
  select count(*) into n_today from public.reward_claims where user_id = u and kind = p_kind and created_at > date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if n_today >= per_day then return jsonb_build_object('ok', false, 'reason', 'That''s all of those for today.', 'state', public.get_state()); end if;
  c := greatest(0, least(cap_c, coalesce(p_coins, 0)));
  pe := greatest(0, least(cap_p, coalesce(p_pearls, 0)));
  x := greatest(0, least(cap_x, coalesce(p_xp, 0)));
  select * into p from public.profiles where id = u for update;
  if not found then raise exception 'No profile yet'; end if;
  lvl_before := p.level;
  lvl_after := public._level_for_xp(p.xp + x);
  v_titles := p.titles;
  if p_title is not null and not (p_title = any (v_titles)) then v_titles := array_append(v_titles, p_title); end if;
  update public.profiles set coins = coins + c, pearls = pearls + pe, xp = xp + x, level = lvl_after, titles = v_titles,
    owned = case when p_item is not null and not (p_item = any (owned)) then array_append(owned, p_item) else owned end,
    updated_at = now() where id = u;
  insert into public.reward_claims (user_id, kind, key, coins, pearls, xp) values (u, p_kind, p_key, c, pe, x);
  return jsonb_build_object('ok', true, 'coins', c, 'pearls', pe, 'xp', x, 'levelUp', case when lvl_after > lvl_before then lvl_after else 0 end, 'state', public.get_state());
end $$;
commit;

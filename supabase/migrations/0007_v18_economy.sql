-- v1.8 economy: Bigger Hold goes to 5 levels (creel up to 45) with higher floor prices.
create or replace function public._creel_max(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select 20 + 5 * least(5, (select count(distinct key) from public.purchases where user_id = u and kind = 'upgrade' and key in ('hold1', 'hold2', 'hold3', 'hold4', 'hold5')))::int
$$;

create or replace function public.spend_coins(p_kind text, p_key text, p_coins int, p_pearls int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; c int := greatest(0, coalesce(p_coins, 0)); pe int := greatest(0, coalesce(p_pearls, 0));
begin
  if p_kind not in ('bait', 'gear', 'upgrade', 'decor') then raise exception 'Unknown purchase'; end if;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad purchase key'; end if;
  if c > 100000 or pe > 1000 then raise exception 'Price out of range'; end if;
  -- hold upgrades raise the creel limit, so they have floor prices and must be bought in order
  if p_kind = 'upgrade' and p_key in ('hold1', 'hold2', 'hold3', 'hold4', 'hold5') then
    if (p_key = 'hold1' and c < 1000) or (p_key = 'hold2' and c < 2500) or (p_key = 'hold3' and c < 5500)
      or (p_key = 'hold4' and pe < 50) or (p_key = 'hold5' and pe < 90) then raise exception 'Bad price'; end if;
    if p_key <> 'hold1' and not exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = 'hold' || (substr(p_key, 5)::int - 1)) then raise exception 'Buy the levels in order'; end if;
    if exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = p_key) then return jsonb_build_object('ok', false, 'reason', 'Already bought.', 'state', public.get_state()); end if;
  end if;
  select * into p from public.profiles where id = u for update;
  if p.coins < c or p.pearls < pe then return jsonb_build_object('ok', false, 'reason', 'Not enough coins.', 'state', public.get_state()); end if;
  update public.profiles set coins = coins - c, pearls = pearls - pe, updated_at = now() where id = u;
  insert into public.purchases (user_id, kind, key, coins, pearls) values (u, p_kind, p_key, c, pe);
  return jsonb_build_object('ok', true, 'state', public.get_state());
end $$;

-- v1.8 rewards: the Valley Expedition, collection milestones, treasure chests, the daily bonus
create or replace function public.claim_reward(p_kind text, p_key text, p_coins int, p_pearls int, p_xp int, p_title text default null, p_item text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public._uid(); p public.profiles;
  cap_c int; cap_p int; cap_x int; per_day int; n_today int;
  c int; pe int; x int; lvl_before int; lvl_after int; v_titles text[];
begin
  -- what each kind can pay out at most, and how many a day
  case p_kind
    when 'quest' then cap_c := 200; cap_p := 2; cap_x := 150; per_day := 4;
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
    when 'story2' then cap_c := 800; cap_p := 30; cap_x := 400; per_day := 8;
    when 'milestone' then cap_c := 3000; cap_p := 40; cap_x := 1500; per_day := 8;
    when 'treasure' then cap_c := 900; cap_p := 10; cap_x := 120; per_day := 10;
    else raise exception 'Unknown reward';
  end case;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad reward key'; end if;
  if p_kind = 'story' and p_key not in ('story0', 'story1', 'story2', 'story3', 'story4', 'story5') then raise exception 'Bad story chapter'; end if;
  if p_kind = 'collection' and p_key not in ('cove', 'frost', 'marsh', 'pond', 'river', 'quarry', 'deep', 'cave', 'weather', 'blood') then raise exception 'Bad collection'; end if;
  if p_kind = 'story2' and p_key not in ('exp0', 'exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6', 'exp7') then raise exception 'Bad expedition part'; end if;
  if p_kind = 'milestone' and p_key not in ('kinds10', 'kinds20', 'kinds30', 'kinds40', 'kindsAll', 'epic1', 'legend1', 'gold5') then raise exception 'Bad milestone'; end if;
  if p_kind = 'tutorial' and p_key <> 'first' then raise exception 'Bad key'; end if;
  if p_kind = 'goal' and p_key not in ('catch5', 'sell', 'bait', 'baitcatch', 'level3', 'boat', 'frost', 'request', 'gear', 'decor', 'rare', 'collection') then raise exception 'Bad goal'; end if;
  if p_title is not null and p_title not in ('Lantern Keeper', 'Cove Regular', 'Frostpine Regular', 'Marsh Wader', 'Pond Pal', 'River Runner', 'Quarry Diver', 'Deep Legend', 'Valley Legend', 'Master Angler', 'Cave Diver', 'Storm Chaser', 'Moon Hunter') then raise exception 'Unknown title'; end if;
  if p_item is not null and p_item not in ('lure_lantern', 'rod_birch', 'rod_bamboo', 'rod_copper', 'lure_duck', 'lure_frog', 'lure_firefly', 'hat_captain', 'acc_vest', 'acc_scarf', 'acc_backpack', 'hat_tophat', 'acc_camera') then raise exception 'Unknown item'; end if;
  if p_item is not null and p_item <> 'lure_lantern' and p_kind <> 'treasure' then raise exception 'Unknown item'; end if;
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

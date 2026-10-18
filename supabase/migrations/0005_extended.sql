-- Reel Time 0005: the newer systems for signed-in players.
--   * profiles.ext: extended state (away gear, bait, quests, story, cabin, nicknames...) saved by save_ext.
--   * claim_reward: quest / story / derby / festival / collection / tutorial rewards, capped per kind and
--     de-duplicated per key, with a daily limit per kind.
--   * spend_coins: bait, gear, upgrades and cabin decor; upgrades are remembered server-side
--     (purchases), and Bigger Hold levels raise the creel limit (_creel_max) for record/move.
--   * give_catch: hand a fish to a local (no coins, no XP).
--   * record_catch gains p_away for away gear (no time-of-day check, common..rare only).
begin;

alter table public.profiles add column if not exists ext jsonb not null default '{}';

create table if not exists public.reward_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  key text not null,
  coins int not null default 0,
  pearls int not null default 0,
  xp int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
create table if not exists public.purchases (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  key text not null,
  coins int not null default 0,
  pearls int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists purchases_user_kind on public.purchases (user_id, kind);
alter table public.reward_claims enable row level security;
alter table public.purchases enable row level security;

-- Creel size: 20 plus 5 per Bigger Hold level bought (at most 3).
create or replace function public._creel_max(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select 20 + 5 * least(3, (select count(distinct key) from public.purchases where user_id = u and kind = 'upgrade' and key in ('hold1', 'hold2', 'hold3')))::int
$$;

create or replace function public.get_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles;
begin
  select * into p from public.profiles where id = u;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', p.display_name, 'avatar', p.avatar, 'level', p.level, 'xp', p.xp, 'title', p.title,
    'titles', to_jsonb(p.titles), 'coins', p.coins, 'pearls', p.pearls, 'owned', to_jsonb(p.owned),
    'equipped', p.equipped, 'settings', p.settings, 'stats', p.stats, 'achievements', p.achievements,
    'bottles', to_jsonb(p.bottles), 'catchCount', p.catch_count,
    'ext', p.ext, 'creelBonus', public._creel_max(u) - 20,
    'creel', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'speciesId', c.species_id, 'variant', c.variant, 'weight', c.weight, 'zone', c.zone, 'ts', (extract(epoch from c.created_at) * 1000)::bigint) order by c.created_at)
      from public.catches c where c.user_id = u and c.status = 'creel'), '[]'::jsonb),
    'storage', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'speciesId', c.species_id, 'variant', c.variant, 'weight', c.weight, 'zone', c.zone, 'ts', (extract(epoch from c.created_at) * 1000)::bigint) order by c.created_at)
      from public.catches c where c.user_id = u and c.status = 'storage'), '[]'::jsonb),
    'fishpedia', coalesce((select jsonb_object_agg(f.species_id, jsonb_build_object('normal', f.normal, 'gold', f.gold, 'diamond', f.diamond, 'best', f.best_weight, 'firstAt', (extract(epoch from f.first_at) * 1000)::bigint, 'zone', f.zone))
      from public.fishpedia f where f.user_id = u), '{}'::jsonb)
  );
end $$;

create or replace function public.save_ext(p_ext jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  if jsonb_typeof(p_ext) <> 'object' then raise exception 'Bad data'; end if;
  if pg_column_size(p_ext) > 65536 then raise exception 'Saved data too large'; end if;
  update public.profiles set ext = p_ext, updated_at = now() where id = u;
  return jsonb_build_object('ok', true);
end $$;

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
    else raise exception 'Unknown reward';
  end case;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad reward key'; end if;
  if p_kind = 'story' and p_key not in ('story0', 'story1', 'story2', 'story3', 'story4', 'story5') then raise exception 'Bad story chapter'; end if;
  if p_kind = 'collection' and p_key not in ('cove', 'frost', 'marsh', 'pond', 'river', 'quarry', 'deep') then raise exception 'Bad collection'; end if;
  if p_kind = 'tutorial' and p_key <> 'first' then raise exception 'Bad key'; end if;
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

create or replace function public.spend_coins(p_kind text, p_key text, p_coins int, p_pearls int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; c int := greatest(0, coalesce(p_coins, 0)); pe int := greatest(0, coalesce(p_pearls, 0));
begin
  if p_kind not in ('bait', 'gear', 'upgrade', 'decor') then raise exception 'Unknown purchase'; end if;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad purchase key'; end if;
  if c > 100000 or pe > 1000 then raise exception 'Price out of range'; end if;
  -- hold upgrades raise the creel limit, so they have floor prices and must be bought in order
  if p_kind = 'upgrade' and p_key in ('hold1', 'hold2', 'hold3') then
    if (p_key = 'hold1' and c < 400) or (p_key = 'hold2' and c < 1000) or (p_key = 'hold3' and pe < 20) then raise exception 'Bad price'; end if;
    if p_key <> 'hold1' and not exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = 'hold' || (substr(p_key, 5)::int - 1)) then raise exception 'Buy the levels in order'; end if;
    if exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = p_key) then return jsonb_build_object('ok', false, 'reason', 'Already bought.', 'state', public.get_state()); end if;
  end if;
  select * into p from public.profiles where id = u for update;
  if p.coins < c or p.pearls < pe then return jsonb_build_object('ok', false, 'reason', 'Not enough coins.', 'state', public.get_state()); end if;
  update public.profiles set coins = coins - c, pearls = pearls - pe, updated_at = now() where id = u;
  insert into public.purchases (user_id, kind, key, coins, pearls) values (u, p_kind, p_key, c, pe);
  return jsonb_build_object('ok', true, 'state', public.get_state());
end $$;

create or replace function public.give_catch(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  update public.catches set status = 'released' where id = p_id and user_id = u and status in ('creel', 'storage');
  return jsonb_build_object('ok', found, 'state', public.get_state());
end $$;

create or replace function public.move_catch(p_id uuid, p_to text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); n int;
begin
  if p_to not in ('creel', 'storage') then raise exception 'Bad destination'; end if;
  select count(*) into n from public.catches where user_id = u and status = p_to;
  if (p_to = 'creel' and n >= public._creel_max(u)) or (p_to = 'storage' and n >= 200) then
    return jsonb_build_object('ok', false, 'state', public.get_state());
  end if;
  update public.catches set status = p_to where id = p_id and user_id = u and status in ('creel', 'storage');
  return jsonb_build_object('ok', found, 'state', public.get_state());
end $$;

drop function if exists public.record_catch(text, text, numeric, text, text, text, boolean, boolean);
create or replace function public.record_catch(
  p_species text, p_variant text, p_weight numeric, p_zone text, p_phase text, p_weather text,
  p_full_moon boolean default false, p_wait boolean default false, p_away boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public._uid();
  sp public.species; t public.tiers; p public.profiles; rec public.records;
  st jsonb; recent int; zone_ok boolean; phase_ok boolean;
  v_pts int; v_xp int; v_value int; lvl_before int; lvl_after int;
  f public.fishpedia; new_species boolean := false; new_slot boolean := false; personal_best boolean := false;
  big_one boolean; is_record boolean := false; daily jsonb := null; today int; wk text;
  creel_n int; storage_n int; where_to text; cid uuid; auto_sold int := 0; great boolean;
begin
  select * into sp from public.species where id = p_species;
  if not found then raise exception 'Unknown species %', p_species; end if;
  select * into t from public.tiers where id = sp.tier;
  if p_variant not in ('normal', 'gold', 'diamond') then raise exception 'Bad variant'; end if;
  if p_weight < sp.min_w or p_weight > sp.max_w then raise exception 'Weight out of range for %', sp.name; end if;
  if p_zone not in ('dock', 'shallows', 'open', 'deep', 'falls', 'ruins', 'frost', 'marsh', 'pond', 'quarry', 'river') then raise exception 'Bad zone'; end if;
  zone_ok := p_zone = any (sp.zones) or (p_zone = 'ruins' and 'deep' = any (sp.zones));
  if not zone_ok then raise exception '% does not live in %', sp.name, p_zone; end if;
  -- Time-of-day rule, checked against the server clock (with a minute of slack at phase changes)
  phase_ok := 'any' = any (sp.times)
    or public._phase_at(now()) = any (sp.times)
    or public._phase_at(now() - interval '60 seconds') = any (sp.times);
  -- Away gear (crab pots, set lines) is emptied later than the bite happened: no time-of-day check,
  -- but only common to rare fish can come from gear.
  if p_away and t.ord <= 2 then phase_ok := true; end if;
  if not phase_ok then raise exception '% is not biting right now', sp.name; end if;
  if sp.weather is not null and not (p_weather = any (sp.weather)) then raise exception '% needs different weather', sp.name; end if;

  select * into p from public.profiles where id = u for update;
  if not found then raise exception 'No profile yet'; end if;
  if p_zone = 'deep' and p.level < 10 then raise exception 'The Deep opens at level 10'; end if;
  if p_zone = 'quarry' and p.level < 10 then raise exception 'The quarry bottom opens at level 10'; end if;
  if p_zone = 'ruins' and p.level < 20 then raise exception 'The ruins open at level 20'; end if;
  select count(*) into recent from public.catches where user_id = u and created_at > now() - interval '60 seconds';
  if recent >= 6 then raise exception 'Easy there! Too many catches in a minute.'; end if;

  st := p.stats;
  st := public._inc(st, 'catches');
  st := public._inc(st, 'sp_' || sp.id);
  if p_variant = 'gold' then st := public._inc(st, 'golds'); end if;
  if p_variant = 'diamond' then st := public._inc(st, 'diamonds'); end if;
  if p_phase = 'dawn' then st := public._inc(st, 'dawnCatches'); end if;
  if p_phase = 'night' then st := public._inc(st, 'nightCatches'); end if;
  if p_weather in ('rain', 'storm') then st := public._inc(st, 'rainCatches'); end if;
  if p_wait then st := public._inc(st, 'waitCatches'); end if;
  if sp.id = 'moonfin' and p_full_moon then st := jsonb_set(st, '{fullMoonMoonfin}', '1'); end if;
  big_one := p_weight >= sp.min_w + (sp.max_w - sp.min_w) * 0.95;
  if big_one then st := public._inc(st, 'bigOnes'); end if;

  -- Fishpedia
  select * into f from public.fishpedia where user_id = u and species_id = sp.id for update;
  if not found then
    new_species := true; new_slot := true; personal_best := true;
    insert into public.fishpedia (user_id, species_id, normal, gold, diamond, best_weight, zone)
      values (u, sp.id, (p_variant = 'normal')::int, (p_variant = 'gold')::int, (p_variant = 'diamond')::int, p_weight, p_zone);
  else
    new_slot := (p_variant = 'normal' and f.normal = 0) or (p_variant = 'gold' and f.gold = 0) or (p_variant = 'diamond' and f.diamond = 0);
    personal_best := p_weight > f.best_weight;
    update public.fishpedia set
      normal = normal + (p_variant = 'normal')::int, gold = gold + (p_variant = 'gold')::int, diamond = diamond + (p_variant = 'diamond')::int,
      best_weight = greatest(best_weight, p_weight)
    where user_id = u and species_id = sp.id;
  end if;
  st := jsonb_set(st, '{speciesCaught}', to_jsonb((select count(*) from public.fishpedia where user_id = u)));
  st := jsonb_set(st, '{diamondSpecies}', to_jsonb((select count(*) from public.fishpedia where user_id = u and diamond > 0)));
  st := jsonb_set(st, '{species_common}', to_jsonb((select count(*) from public.fishpedia fp join public.species s on s.id = fp.species_id where fp.user_id = u and s.tier = 'common')));
  st := jsonb_set(st, '{species_uncommon}', to_jsonb((select count(*) from public.fishpedia fp join public.species s on s.id = fp.species_id where fp.user_id = u and s.tier = 'uncommon')));
  st := jsonb_set(st, '{species_rare}', to_jsonb((select count(*) from public.fishpedia fp join public.species s on s.id = fp.species_id where fp.user_id = u and s.tier = 'rare')));
  st := jsonb_set(st, '{species_epic}', to_jsonb((select count(*) from public.fishpedia fp join public.species s on s.id = fp.species_id where fp.user_id = u and s.tier = 'epic')));

  -- Scores
  v_pts := t.points * case p_variant when 'gold' then 3 when 'diamond' then 10 else 1 end;
  wk := to_char(public._week_start(), 'YYYY-MM-DD');
  if coalesce(st ->> 'week', '') <> wk then
    st := st || jsonb_build_object('week', wk, 'weekScore', 0, 'weekDiamonds', 0, 'weekHeaviest', 0);
  end if;
  st := public._inc(st, 'weekScore', v_pts);
  st := public._inc(st, 'allScore', v_pts);
  if p_variant = 'diamond' then st := public._inc(st, 'weekDiamonds'); end if;
  st := jsonb_set(st, '{weekHeaviest}', to_jsonb(greatest(coalesce((st ->> 'weekHeaviest')::numeric, 0), p_weight)));
  st := jsonb_set(st, '{heaviest}', to_jsonb(greatest(coalesce((st ->> 'heaviest')::numeric, 0), p_weight)));

  -- Lake record
  select * into rec from public.records where species_id = sp.id for update;
  if not found then
    insert into public.records (species_id, user_id, name, weight) values (sp.id, u, p.display_name, p_weight);
  elsif p_weight > rec.weight then
    update public.records set user_id = u, name = p.display_name, weight = p_weight, created_at = now() where species_id = sp.id;
    -- Only taking a record from someone else counts as setting one.
    if rec.user_id is distinct from u then
      is_record := true;
      st := public._inc(st, 'records');
    end if;
  end if;

  -- Daily first-catch bonus (UTC day)
  today := floor(extract(epoch from now()) / 86400)::int;
  if coalesce((st ->> 'lastDaily')::int, -1) <> today then
    st := jsonb_set(st, '{lastDaily}', to_jsonb(today));
    p.coins := p.coins + 25; p.pearls := p.pearls + 1;
    daily := jsonb_build_object('coins', 25, 'pearls', 1);
  end if;

  v_xp := round(t.xp * (1 + 0.1 * sp.difficulty));
  v_value := greatest(1, round(t.coins * case p_variant when 'gold' then 5 when 'diamond' then 25 else 1 end * ((p_weight / sp.max_w) * 0.5 + 0.75)));
  lvl_before := p.level;
  lvl_after := public._level_for_xp(p.xp + v_xp);

  select count(*) filter (where status = 'creel'), count(*) filter (where status = 'storage') into creel_n, storage_n
    from public.catches where user_id = u and status in ('creel', 'storage');
  where_to := case when creel_n < public._creel_max(u) then 'creel' when storage_n < 200 then 'storage' else 'sold' end;
  if where_to = 'sold' then auto_sold := v_value; p.coins := p.coins + v_value; st := public._inc(st, 'sold'); end if;

  insert into public.catches (user_id, species_id, variant, weight, zone, phase, weather, points, status)
    values (u, sp.id, p_variant, p_weight, p_zone, p_phase, p_weather, v_pts, where_to) returning id into cid;

  update public.profiles set stats = st, xp = p.xp + v_xp, level = lvl_after, coins = p.coins, pearls = p.pearls,
    catch_count = catch_count + 1, updated_at = now() where id = u;

  great := t.ord >= 2 or p_variant <> 'normal' or is_record;
  if great then
    insert into public.feed (user_id, name, kind, payload) values (u, p.display_name, 'catch',
      jsonb_build_object('speciesId', sp.id, 'variant', p_variant, 'weight', p_weight, 'zone', p_zone, 'record', is_record));
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object('catchId', cid, 'speciesId', sp.id, 'variant', p_variant, 'weight', p_weight, 'xp', v_xp,
      'levelUp', case when lvl_after > lvl_before then lvl_after else 0 end, 'value', v_value, 'newSpecies', new_species,
      'newSlot', new_slot, 'personalBest', personal_best, 'bigOne', big_one, 'record', is_record, 'daily', daily,
      'points', v_pts, 'where', where_to, 'autoSold', auto_sold),
    'state', public.get_state());
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.get_state(), public.ensure_profile(text), public.record_catch(text, text, numeric, text, text, text, boolean, boolean, boolean),
  public.record_junk(text), public.sell_catches(uuid[]), public.release_catch(uuid), public.trade_catch(uuid), public.move_catch(uuid, text),
  public.buy_item(text), public.equip_item(text, text), public.claim_achievement(text), public.bump_stat(text, int),
  public.save_profile(jsonb), public.react_feed(uuid, text), public.import_guest(jsonb),
  public.save_ext(jsonb), public.claim_reward(text, text, int, int, int, text, text), public.spend_coins(text, text, int, int), public.give_catch(uuid) to authenticated;
grant execute on function public.leaderboard(text, text), public.top_trophies() to anon, authenticated;
commit;

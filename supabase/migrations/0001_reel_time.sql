-- Reel Time: schema, row-level security and server functions.
-- Every balance change (coins, pearls, XP, catches, purchases) happens inside a SECURITY DEFINER
-- function that validates the request, so players can read public rows but never write tables directly.
-- Seed data (species, tiers, items, achievements) is in 0002_seed.sql, generated from src/data by
-- `node scripts/gen-seed.mjs`.

-- gen_random_uuid() is built into Postgres 13+.

-- ---------------------------------------------------------------- reference data
create table if not exists public.tiers (
  id text primary key, ord int not null, coins int not null, xp int not null, points int not null,
  pearls_trade int not null default 0, diamond_pearls int not null default 0
);
create table if not exists public.species (
  id text primary key, name text not null, tier text not null references public.tiers(id),
  zones text[] not null, times text[] not null, weather text[], min_w numeric not null, max_w numeric not null,
  difficulty int not null
);
create table if not exists public.items (
  id text primary key, kind text not null, name text not null, price_coins int, price_pearls int, source text not null
);
create table if not exists public.achievement_defs (
  id text primary key, name text not null, tier text not null, stat text not null, threshold int not null,
  reward_coins int not null default 0, reward_pearls int not null default 0, reward_item text, reward_title text
);

-- ---------------------------------------------------------------- player data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Angler' check (char_length(display_name) between 1 and 20),
  avatar jsonb,
  level int not null default 1,
  xp int not null default 0,
  title text not null default '',
  titles text[] not null default '{}',
  coins int not null default 0 check (coins >= 0),
  pearls int not null default 0 check (pearls >= 0),
  owned text[] not null default '{rod_willow,lure_classic,boat_oak}',
  equipped jsonb not null default '{"rod":"rod_willow","lure":"lure_classic","boat":"boat_oak"}',
  settings jsonb not null default '{}',
  stats jsonb not null default '{}',
  achievements jsonb not null default '{}',
  bottles int[] not null default '{}',
  catch_count int not null default 0,
  guest_imported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  species_id text not null references public.species(id),
  variant text not null check (variant in ('normal', 'gold', 'diamond')),
  weight numeric not null,
  zone text not null,
  phase text not null,
  weather text not null,
  points int not null default 0,
  status text not null default 'creel' check (status in ('creel', 'storage', 'sold', 'released', 'traded')),
  created_at timestamptz not null default now()
);
create index if not exists catches_user_status on public.catches (user_id, status);
create index if not exists catches_created on public.catches (created_at);

create table if not exists public.fishpedia (
  user_id uuid not null references public.profiles(id) on delete cascade,
  species_id text not null references public.species(id),
  normal int not null default 0, gold int not null default 0, diamond int not null default 0,
  best_weight numeric not null default 0, first_at timestamptz not null default now(), zone text,
  primary key (user_id, species_id)
);

create table if not exists public.feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null,
  payload jsonb not null default '{}',
  reactions jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists feed_created on public.feed (created_at desc);

create table if not exists public.feed_reactions (
  feed_id uuid references public.feed(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  primary key (feed_id, user_id)
);

create table if not exists public.records (
  species_id text primary key references public.species(id),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  weight numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security
alter table public.tiers enable row level security;
alter table public.species enable row level security;
alter table public.items enable row level security;
alter table public.achievement_defs enable row level security;
alter table public.profiles enable row level security;
alter table public.catches enable row level security;
alter table public.fishpedia enable row level security;
alter table public.feed enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.records enable row level security;

-- Public reads; no direct writes (all writes go through the functions below).
drop policy if exists "read tiers" on public.tiers;
create policy "read tiers" on public.tiers for select using (true);
drop policy if exists "read species" on public.species;
create policy "read species" on public.species for select using (true);
drop policy if exists "read items" on public.items;
create policy "read items" on public.items for select using (true);
drop policy if exists "read achievement defs" on public.achievement_defs;
create policy "read achievement defs" on public.achievement_defs for select using (true);
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select using (true);
drop policy if exists "read own catches" on public.catches;
create policy "read own catches" on public.catches for select using (auth.uid() = user_id);
drop policy if exists "read fishpedia" on public.fishpedia;
create policy "read fishpedia" on public.fishpedia for select using (true);
drop policy if exists "read feed" on public.feed;
create policy "read feed" on public.feed for select using (true);
drop policy if exists "read records" on public.records;
create policy "read records" on public.records for select using (true);

-- Live feed over Supabase Realtime
do $$ begin
  alter publication supabase_realtime add table public.feed;
exception when others then raise notice 'realtime publication not available here: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- helpers
create or replace function public._inc(s jsonb, k text, n int default 1) returns jsonb
language sql immutable as $$
  select jsonb_set(coalesce(s, '{}'::jsonb), array[k], to_jsonb(coalesce((s ->> k)::numeric, 0) + n));
$$;

create or replace function public._xp_for_level(l int) returns int language sql immutable as $$ select 50 * l * (l - 1) $$;

create or replace function public._level_for_xp(x int) returns int language plpgsql immutable as $$
declare l int := 1;
begin
  while l < 50 and x >= public._xp_for_level(l + 1) loop l := l + 1; end loop;
  return l;
end $$;

-- In-game phase from the shared wall clock (one day = 24 real minutes), matching src/core/clock.js
create or replace function public._phase_at(ts timestamptz) returns text language sql immutable as $$
  select case
    when f >= 0.2 and f < 0.3 then 'dawn'
    when f >= 0.3 and f < 0.7 then 'day'
    when f >= 0.7 and f < 0.8 then 'dusk'
    else 'night' end
  from (select mod((extract(epoch from ts) * 1000)::numeric, 1440000) / 1440000 as f) q;
$$;

create or replace function public._week_start(ts timestamptz default now()) returns timestamptz language sql stable as $$
  select date_trunc('week', ts at time zone 'America/New_York') at time zone 'America/New_York';
$$;

create or replace function public._uid() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Please sign in first.' using errcode = '28000'; end if;
  return u;
end $$;

-- Full client-side state for the caller (shape matches src/game/rules.js newProfile()).
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
    'creel', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'speciesId', c.species_id, 'variant', c.variant, 'weight', c.weight, 'zone', c.zone, 'ts', (extract(epoch from c.created_at) * 1000)::bigint) order by c.created_at)
      from public.catches c where c.user_id = u and c.status = 'creel'), '[]'::jsonb),
    'storage', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'speciesId', c.species_id, 'variant', c.variant, 'weight', c.weight, 'zone', c.zone, 'ts', (extract(epoch from c.created_at) * 1000)::bigint) order by c.created_at)
      from public.catches c where c.user_id = u and c.status = 'storage'), '[]'::jsonb),
    'fishpedia', coalesce((select jsonb_object_agg(f.species_id, jsonb_build_object('normal', f.normal, 'gold', f.gold, 'diamond', f.diamond, 'best', f.best_weight, 'firstAt', (extract(epoch from f.first_at) * 1000)::bigint, 'zone', f.zone))
      from public.fishpedia f where f.user_id = u), '{}'::jsonb)
  );
end $$;

-- Create the caller's profile on first sign-in.
create or replace function public.ensure_profile(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); created boolean := false;
begin
  if not exists (select 1 from public.profiles where id = u) then
    insert into public.profiles (id, display_name) values (u, left(coalesce(nullif(trim(p_name), ''), 'Angler'), 20));
    created := true;
  end if;
  return jsonb_build_object('created', created, 'state', public.get_state());
end $$;

-- ---------------------------------------------------------------- catching
create or replace function public.record_catch(
  p_species text, p_variant text, p_weight numeric, p_zone text, p_phase text, p_weather text,
  p_full_moon boolean default false, p_wait boolean default false
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
  if p_zone not in ('dock', 'shallows', 'open', 'deep', 'falls', 'ruins') then raise exception 'Bad zone'; end if;
  zone_ok := p_zone = any (sp.zones) or (p_zone = 'ruins' and 'deep' = any (sp.zones));
  if not zone_ok then raise exception '% does not live in %', sp.name, p_zone; end if;
  -- Time-of-day rule, checked against the server clock (with a minute of slack at phase changes)
  phase_ok := 'any' = any (sp.times)
    or public._phase_at(now()) = any (sp.times)
    or public._phase_at(now() - interval '60 seconds') = any (sp.times);
  if not phase_ok then raise exception '% is not biting right now', sp.name; end if;
  if sp.weather is not null and not (p_weather = any (sp.weather)) then raise exception '% needs different weather', sp.name; end if;

  select * into p from public.profiles where id = u for update;
  if not found then raise exception 'No profile yet'; end if;
  if p_zone = 'deep' and p.level < 10 then raise exception 'The Deep opens at level 10'; end if;
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
  where_to := case when creel_n < 20 then 'creel' when storage_n < 200 then 'storage' else 'sold' end;
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

create or replace function public.record_junk(p_junk text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; st jsonb; out jsonb; v_coins int := 0; v_pearls int := 0; idx int; unfound int[]; lvl int;
begin
  if p_junk not in ('boot', 'can', 'lilypad', 'bottle', 'chest') then raise exception 'Bad junk'; end if;
  select * into p from public.profiles where id = u for update;
  if (select count(*) from public.catches where user_id = u and created_at > now() - interval '60 seconds') >= 6 then raise exception 'Easy there!'; end if;
  st := public._inc(p.stats, 'junk');
  out := jsonb_build_object('junkId', p_junk);
  if p_junk = 'boot' then st := public._inc(st, 'boots'); end if;
  if p_junk = 'chest' then
    st := public._inc(st, 'chests');
    v_coins := 50 + floor(random() * 101)::int;
    if random() < 0.25 then v_pearls := 1 + floor(random() * 3)::int; end if;
    out := out || jsonb_build_object('coins', v_coins, 'pearls', nullif(v_pearls, 0));
  end if;
  if p_junk = 'bottle' then
    select array_agg(i) into unfound from generate_series(0, 11) i where not (i = any (p.bottles));
    idx := coalesce(unfound[1 + floor(random() * coalesce(array_length(unfound, 1), 0))::int], floor(random() * 12)::int);
    if not (idx = any (p.bottles)) then p.bottles := p.bottles || idx; end if;
    st := jsonb_set(st, '{bottleMessages}', to_jsonb(coalesce(array_length(p.bottles, 1), 0)));
    out := out || jsonb_build_object('messageIndex', idx);
  end if;
  lvl := public._level_for_xp(p.xp + 2);
  update public.profiles set stats = st, coins = coins + v_coins, pearls = pearls + v_pearls, xp = xp + 2,
    level = lvl, bottles = p.bottles, updated_at = now() where id = u;
  out := out || jsonb_build_object('levelUp', case when lvl > p.level then lvl else 0 end);
  return jsonb_build_object('out', out, 'state', public.get_state());
end $$;

create or replace function public._catch_value(c public.catches) returns int language sql stable as $$
  select greatest(1, round(t.coins * case c.variant when 'gold' then 5 when 'diamond' then 25 else 1 end * ((c.weight / s.max_w) * 0.5 + 0.75)))::int
  from public.species s join public.tiers t on t.id = s.tier where s.id = c.species_id;
$$;

create or replace function public.sell_catches(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); total int := 0; n int := 0; c public.catches;
begin
  for c in select * from public.catches where user_id = u and id = any (p_ids) and status in ('creel', 'storage') for update loop
    total := total + public._catch_value(c); n := n + 1;
    update public.catches set status = 'sold' where id = c.id;
  end loop;
  update public.profiles set coins = coins + total, stats = public._inc(stats, 'sold', n), updated_at = now() where id = u;
  return jsonb_build_object('coins', total, 'sold', n, 'state', public.get_state());
end $$;

create or replace function public.release_catch(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; lvl int;
begin
  update public.catches set status = 'released' where id = p_id and user_id = u and status in ('creel', 'storage');
  if not found then raise exception 'That fish is not in your creel.'; end if;
  select * into p from public.profiles where id = u for update;
  lvl := public._level_for_xp(p.xp + 5);
  update public.profiles set xp = xp + 5, level = lvl, stats = public._inc(stats, 'releases'), updated_at = now() where id = u;
  return jsonb_build_object('xp', 5, 'levelUp', case when lvl > p.level then lvl else 0 end, 'state', public.get_state());
end $$;

create or replace function public.trade_catch(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); c public.catches; t public.tiers; v_pearls int;
begin
  select * into c from public.catches where id = p_id and user_id = u and status in ('creel', 'storage') for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'That fish is not in your creel.', 'state', public.get_state()); end if;
  select tr.* into t from public.species s join public.tiers tr on tr.id = s.tier where s.id = c.species_id;
  v_pearls := case when c.variant = 'diamond' then t.diamond_pearls else t.pearls_trade end;
  if v_pearls <= 0 then return jsonb_build_object('ok', false, 'reason', 'This fish cannot be traded for Pearls.', 'state', public.get_state()); end if;
  update public.catches set status = 'traded' where id = c.id;
  update public.profiles set pearls = pearls + v_pearls, stats = public._inc(stats, 'traded'), updated_at = now() where id = u;
  return jsonb_build_object('ok', true, 'pearls', v_pearls, 'state', public.get_state());
end $$;

create or replace function public.move_catch(p_id uuid, p_to text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); n int;
begin
  if p_to not in ('creel', 'storage') then raise exception 'Bad destination'; end if;
  select count(*) into n from public.catches where user_id = u and status = p_to;
  if (p_to = 'creel' and n >= 20) or (p_to = 'storage' and n >= 200) then
    return jsonb_build_object('ok', false, 'state', public.get_state());
  end if;
  update public.catches set status = p_to where id = p_id and user_id = u and status in ('creel', 'storage');
  return jsonb_build_object('ok', found, 'state', public.get_state());
end $$;

-- ---------------------------------------------------------------- shop & gear
create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); it public.items; p public.profiles;
begin
  select * into it from public.items where id = p_item;
  if not found or it.source <> 'shop' then return jsonb_build_object('ok', false, 'reason', 'Not for sale.', 'state', public.get_state()); end if;
  select * into p from public.profiles where id = u for update;
  if p_item = any (p.owned) then return jsonb_build_object('ok', false, 'reason', 'You already own this.', 'state', public.get_state()); end if;
  if it.kind = 'boat' and p.level < 3 then return jsonb_build_object('ok', false, 'reason', 'Boats unlock at level 3.', 'state', public.get_state()); end if;
  if coalesce(it.price_coins, 0) > p.coins then return jsonb_build_object('ok', false, 'reason', 'Not enough coins.', 'state', public.get_state()); end if;
  if coalesce(it.price_pearls, 0) > p.pearls then return jsonb_build_object('ok', false, 'reason', 'Not enough Pearls.', 'state', public.get_state()); end if;
  update public.profiles set coins = coins - coalesce(it.price_coins, 0), pearls = pearls - coalesce(it.price_pearls, 0),
    owned = owned || p_item, stats = public._inc(stats, 'purchases'), updated_at = now() where id = u;
  return jsonb_build_object('ok', true, 'item', p_item, 'state', public.get_state());
end $$;

create or replace function public.equip_item(p_slot text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); it public.items;
begin
  select * into it from public.items where id = p_item;
  if not found or it.kind <> p_slot or p_slot not in ('rod', 'lure', 'boat') then return jsonb_build_object('ok', false, 'state', public.get_state()); end if;
  update public.profiles set equipped = jsonb_set(equipped, array[p_slot], to_jsonb(p_item)), updated_at = now()
    where id = u and p_item = any (owned);
  return jsonb_build_object('ok', found, 'state', public.get_state());
end $$;

-- ---------------------------------------------------------------- achievements & stats
create or replace function public.claim_achievement(p_ach text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); a public.achievement_defs; p public.profiles;
begin
  select * into a from public.achievement_defs where id = p_ach;
  if not found then raise exception 'Unknown achievement'; end if;
  select * into p from public.profiles where id = u for update;
  if p.achievements ? p_ach then return jsonb_build_object('ok', false, 'state', public.get_state()); end if;
  if coalesce((p.stats ->> a.stat)::numeric, 0) < a.threshold then return jsonb_build_object('ok', false, 'state', public.get_state()); end if;
  update public.profiles set
    achievements = achievements || jsonb_build_object(p_ach, (extract(epoch from now()) * 1000)::bigint),
    coins = coins + a.reward_coins, pearls = pearls + a.reward_pearls,
    owned = case when a.reward_item is not null and not (a.reward_item = any (owned)) then owned || a.reward_item else owned end,
    titles = case when a.reward_title is not null and not (a.reward_title = any (titles)) then titles || a.reward_title else titles end,
    title = case when a.reward_title is not null and title = '' then a.reward_title else title end,
    updated_at = now()
  where id = u;
  if a.tier = 'gold' then
    insert into public.feed (user_id, name, kind, payload) values (u, p.display_name, 'achievement', jsonb_build_object('achId', p_ach));
  end if;
  return jsonb_build_object('ok', true, 'achId', p_ach, 'state', public.get_state());
end $$;

-- Counters only the client can observe, capped per call.
create or replace function public.bump_stat(p_key text, p_n int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  if p_key in ('goodCompany', 'avatarSaves') then
    update public.profiles set stats = jsonb_set(stats, array[p_key], '1') where id = u;
  elsif p_key in ('perfectCasts', 'cleanReels', 'boatLaunches', 'raftUps', 'reactions') then
    update public.profiles set stats = public._inc(stats, p_key, least(greatest(p_n, 0), 1)) where id = u;
  else
    raise exception 'Unknown stat %', p_key;
  end if;
  return public.get_state();
end $$;

-- ---------------------------------------------------------------- profile edits
create or replace function public.save_profile(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles;
begin
  select * into p from public.profiles where id = u for update;
  if p_patch ? 'avatar' then
    if pg_column_size(p_patch -> 'avatar') > 2000 then raise exception 'Avatar too large'; end if;
    update public.profiles set avatar = p_patch -> 'avatar', stats = jsonb_set(stats, '{avatarSaves}', '1') where id = u;
  end if;
  if p_patch ? 'settings' then
    if pg_column_size(p_patch -> 'settings') > 2000 then raise exception 'Settings too large'; end if;
    update public.profiles set settings = settings || (p_patch -> 'settings') where id = u;
  end if;
  if p_patch ? 'name' then
    update public.profiles set display_name = left(coalesce(nullif(trim(p_patch ->> 'name'), ''), 'Angler'), 20) where id = u;
  end if;
  if p_patch ? 'title' then
    update public.profiles set title = p_patch ->> 'title' where id = u and (p_patch ->> 'title' = '' or (p_patch ->> 'title') = any (titles));
  end if;
  update public.profiles set updated_at = now() where id = u;
  return public.get_state();
end $$;

create or replace function public.react_feed(p_feed uuid, p_emoji text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  if p_emoji not in ('👏', '😮', '❤️') then raise exception 'Bad reaction'; end if;
  insert into public.feed_reactions (feed_id, user_id, emoji) values (p_feed, u, p_emoji) on conflict do nothing;
  if found then
    update public.feed set reactions = jsonb_set(reactions, array[p_emoji], to_jsonb(coalesce((reactions ->> p_emoji)::int, 0) + 1)) where id = p_feed;
    update public.profiles set stats = public._inc(stats, 'reactions') where id = u;
  end if;
  return public.get_state();
end $$;

-- ---------------------------------------------------------------- boards
create or replace function public.leaderboard(p_board text, p_period text default 'week') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); since timestamptz; v_rows jsonb;
begin
  since := case when p_period = 'week' then public._week_start() else '-infinity'::timestamptz end;
  with scores as (
    select c.user_id as id,
      case p_board
        when 'top' then sum(c.points)::numeric
        when 'diamonds' then count(*) filter (where c.variant = 'diamond')::numeric
        when 'heaviest' then max(c.weight)
      end as score
    from public.catches c where c.created_at >= since and p_board in ('top', 'diamonds', 'heaviest')
    group by c.user_id
    union all
    select f.user_id, sum((f.normal > 0)::int + (f.gold > 0)::int + (f.diamond > 0)::int)::numeric
    from public.fishpedia f where p_board = 'pedia' group by f.user_id
  ), ranked as (
    select s.id, s.score, rank() over (order by s.score desc) as rnk from scores s where s.score > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', p.display_name, 'level', p.level, 'title', p.title,
    'score', r.score, 'rank', r.rnk, 'me', coalesce(r.id = u, false)) order by r.rnk), '[]'::jsonb)
  into v_rows
  from ranked r join public.profiles p on p.id = r.id
  where r.rnk <= 10 or r.id = u;
  return v_rows;
end $$;

-- Crown last week's top angler. Schedule weekly with pg_cron (see SETUP.md):
--   select cron.schedule('reel-time-weekly', '5 4 * * 1', 'select public.close_week()');
create or replace function public.close_week() returns uuid
language plpgsql security definer set search_path = public as $$
declare winner uuid; ws timestamptz := public._week_start(now() - interval '7 days'); we timestamptz := public._week_start();
begin
  select user_id into winner from public.catches where created_at >= ws and created_at < we
    group by user_id order by sum(points) desc limit 1;
  if winner is not null then
    update public.profiles set stats = public._inc(stats, 'weeklyWins') where id = winner;
    insert into public.feed (user_id, name, kind, payload)
      select winner, display_name, 'champion', jsonb_build_object('week', to_char(ws, 'YYYY-MM-DD')) from public.profiles where id = winner;
  end if;
  return winner;
end $$;

-- One-time import of guest progress, capped so it cannot be used to mint wealth.
create or replace function public.import_guest(p_state jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; k text; v jsonb; st jsonb := '{}'; v_xp int;
begin
  select * into p from public.profiles where id = u for update;
  if p.guest_imported or p.catch_count > 0 then return public.get_state(); end if;
  v_xp := least(coalesce((p_state ->> 'xp')::int, 0), public._xp_for_level(10));
  for k in select unnest(array['catches', 'perfectCasts', 'cleanReels', 'releases', 'nightCatches', 'dawnCatches', 'rainCatches', 'golds', 'diamonds', 'boots', 'chests', 'junk']) loop
    if p_state -> 'stats' ? k then st := st || jsonb_build_object(k, least(coalesce((p_state -> 'stats' ->> k)::int, 0), 500)); end if;
  end loop;
  update public.profiles set
    avatar = coalesce(p_state -> 'avatar', avatar),
    settings = coalesce(p_state -> 'settings', settings),
    xp = v_xp, level = public._level_for_xp(v_xp),
    coins = least(coalesce((p_state ->> 'coins')::int, 0), 2000),
    pearls = least(coalesce((p_state ->> 'pearls')::int, 0), 20),
    stats = st,
    catch_count = least(coalesce((p_state ->> 'catchCount')::int, 0), 500),
    guest_imported = true, updated_at = now()
  where id = u;
  for k, v in select * from jsonb_each(coalesce(p_state -> 'fishpedia', '{}')) loop
    if exists (select 1 from public.species where id = k) then
      insert into public.fishpedia (user_id, species_id, normal, gold, diamond, best_weight)
      select u, k, least(coalesce((v ->> 'normal')::int, 0), 500), least(coalesce((v ->> 'gold')::int, 0), 50), least(coalesce((v ->> 'diamond')::int, 0), 10),
        least(coalesce((v ->> 'best')::numeric, 0), s.max_w)
      from public.species s where s.id = k
      on conflict do nothing;
    end if;
  end loop;
  update public.profiles set stats = stats
    || jsonb_build_object('speciesCaught', (select count(*) from public.fishpedia where user_id = u))
  where id = u;
  return public.get_state();
end $$;

-- Lock down: only the functions are callable; tables are read-only via policies above.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.tiers, public.species, public.items, public.achievement_defs, public.profiles,
  public.fishpedia, public.feed, public.records to anon, authenticated;
grant select on public.catches to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.get_state(), public.ensure_profile(text), public.record_catch(text, text, numeric, text, text, text, boolean, boolean),
  public.record_junk(text), public.sell_catches(uuid[]), public.release_catch(uuid), public.trade_catch(uuid), public.move_catch(uuid, text),
  public.buy_item(text), public.equip_item(text, text), public.claim_achievement(text), public.bump_stat(text, int),
  public.save_profile(jsonb), public.react_feed(uuid, text), public.import_guest(jsonb) to authenticated;
grant execute on function public.leaderboard(text, text) to anon, authenticated;

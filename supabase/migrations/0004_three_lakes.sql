-- Three Lakes Valley: new fishing zones (Frostpine Lake, Lilymarsh, Fern Pond, Old Quarry, Willow River).
-- record_catch accepts the new zones (the quarry bottom is gated at level 10 like The Deep),
-- and species rows pick up the lakes they now live in.
begin;
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
  if p_zone not in ('dock', 'shallows', 'open', 'deep', 'falls', 'ruins', 'frost', 'marsh', 'pond', 'quarry', 'river') then raise exception 'Bad zone'; end if;
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

insert into public.species (id, name, tier, zones, times, weather, min_w, max_w, difficulty) values
  ('bluegill', 'Bluegill', 'common', array['dock','shallows','pond']::text[], array['any']::text[], null, 0.2, 1, 1),
  ('perch', 'Yellow Perch', 'common', array['dock','shallows','frost','pond']::text[], array['day']::text[], null, 0.3, 1.5, 1),
  ('minnow', 'Fathead Minnow', 'common', array['shallows','frost','river']::text[], array['any']::text[], null, 0.05, 0.2, 1),
  ('pumpkinseed', 'Pumpkinseed Sunfish', 'common', array['shallows','marsh','pond']::text[], array['day']::text[], null, 0.2, 1, 1),
  ('crappie', 'Black Crappie', 'common', array['dock','shallows','marsh','pond']::text[], array['dusk','night']::text[], null, 0.5, 2, 1),
  ('shiner', 'Golden Shiner', 'common', array['shallows','pond','river']::text[], array['dawn','day']::text[], null, 0.1, 0.5, 1),
  ('bullhead', 'Bullhead', 'common', array['dock','marsh']::text[], array['night']::text[], null, 0.5, 3, 2),
  ('rockbass', 'Rock Bass', 'common', array['falls','quarry','river']::text[], array['any']::text[], null, 0.3, 1.5, 2),
  ('cod', 'Blocky Cod', 'common', array['open','deep','quarry']::text[], array['any']::text[], null, 2, 8, 2),
  ('carp', 'Common Carp', 'common', array['shallows','open','marsh']::text[], array['any']::text[], null, 3, 20, 2),
  ('largemouth', 'Largemouth Bass', 'uncommon', array['dock','shallows','open','pond','river']::text[], array['dawn','dusk']::text[], null, 1, 10, 2),
  ('smallmouth', 'Smallmouth Bass', 'uncommon', array['falls','quarry','river']::text[], array['day']::text[], null, 1, 6, 2),
  ('rainbowtrout', 'Rainbow Trout', 'uncommon', array['falls','frost','river']::text[], array['dawn']::text[], null, 1, 8, 3),
  ('browntrout', 'Brown Trout', 'uncommon', array['falls','frost']::text[], array['dusk']::text[], null, 1, 10, 3),
  ('walleye', 'Walleye', 'uncommon', array['open','deep','frost','quarry']::text[], array['dusk','night']::text[], null, 2, 12, 3),
  ('pike', 'Northern Pike', 'uncommon', array['shallows','open','marsh','river']::text[], array['day']::text[], null, 3, 20, 3),
  ('catfish', 'Channel Catfish', 'uncommon', array['dock','open','deep','marsh','quarry']::text[], array['night']::text[], null, 2, 25, 3),
  ('puffer', 'Pond Pufferfish', 'uncommon', array['shallows','marsh']::text[], array['day']::text[], null, 0.5, 2, 2),
  ('salmon', 'Sockeye Salmon', 'rare', array['falls','frost','river']::text[], array['dawn']::text[], null, 4, 15, 3),
  ('muskie', 'Muskellunge', 'rare', array['open','deep','quarry']::text[], array['day']::text[], null, 10, 40, 4),
  ('sturgeon', 'Lake Sturgeon', 'rare', array['deep','quarry']::text[], array['any']::text[], null, 20, 80, 4),
  ('koi', 'Koi', 'rare', array['shallows','marsh','pond']::text[], array['day']::text[], array['clear']::text[], 2, 15, 3),
  ('char', 'Arctic Char', 'rare', array['deep','frost']::text[], array['dawn']::text[], null, 2, 12, 3),
  ('gar', 'Longnose Gar', 'rare', array['shallows','marsh']::text[], array['dusk']::text[], null, 3, 20, 4),
  ('paddlefish', 'Paddlefish', 'epic', array['deep','quarry']::text[], array['day']::text[], null, 20, 90, 4),
  ('gloweel', 'Glow Eel', 'epic', array['open','deep','quarry']::text[], array['night']::text[], null, 2, 10, 4),
  ('moonfin', 'Moonfin', 'epic', array['open','frost']::text[], array['night']::text[], null, 3, 18, 4),
  ('ghostkoi', 'Ghost Koi', 'epic', array['shallows','marsh','pond']::text[], array['night']::text[], array['rain','storm']::text[], 4, 20, 5),
  ('oldwhiskers', 'Old Whiskers', 'legendary', array['deep']::text[], array['night']::text[], null, 60, 150, 5),
  ('crystalpike', 'Crystal Pike', 'legendary', array['falls','frost']::text[], array['dawn']::text[], null, 15, 45, 5),
  ('stormsturgeon', 'Storm Sturgeon', 'legendary', array['deep','quarry']::text[], array['any']::text[], array['storm']::text[], 80, 200, 5),
  ('lanternfish', 'Lanternfish of the Ruins', 'mythic', array['ruins']::text[], array['night']::text[], null, 5, 25, 5)
on conflict (id) do update set name = excluded.name, tier = excluded.tier, zones = excluded.zones, times = excluded.times, weather = excluded.weather, min_w = excluded.min_w, max_w = excluded.max_w, difficulty = excluded.difficulty;
commit;

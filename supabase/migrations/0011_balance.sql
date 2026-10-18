-- v1.13.9 balance pass: about 80 hours of regular play to level 50 and the best gear (see docs/build-notes.md).
-- Apply before shipping v1.13.9 to the web build. Safe to run once; re-running is harmless.

-- 1) The level curve: early levels stay quick, later ones take real time. Matches src/game/rules.js xpForLevel.
create or replace function public._xp_for_level(l int) returns int language sql immutable as $$
  select round(50 * l * (l - 1) * (1 + 1.7 * power(l / 50.0, 1.5)))::int
$$;

-- Nobody loses a level: lift XP to the new curve's floor for the level each player had reached, then recompute.
update public.profiles set xp = greatest(xp, public._xp_for_level(level)), updated_at = now() where xp < public._xp_for_level(level);
update public.profiles set level = public._level_for_xp(xp) where level <> public._level_for_xp(xp);

-- 2) Shop prices and the level each item needs. Players keep everything they already own.
alter table public.items add column if not exists min_level int not null default 1;
update public.items i set price_coins = v.c, price_pearls = v.p, min_level = v.l
from (values
  ('rod_birch', 150, null, 1),
  ('rod_bamboo', 1500, null, 5),
  ('rod_copper', 8000, null, 12),
  ('rod_cherry', null, 90, 18),
  ('rod_neon', null, 150, 24),
  ('rod_obsidian', null, 260, 30),
  ('rod_diamond', null, 500, 40),
  ('lure_duck', 100, null, 1),
  ('lure_frog', 900, null, 5),
  ('lure_firefly', 4000, null, 10),
  ('lure_spinner', null, 60, 15),
  ('lure_crystal', null, 280, 32),
  ('lure_lantern', null, 350, 22),
  ('boat_blue', 800, null, 3),
  ('boat_birch', 3500, null, 8),
  ('boat_canoe', 20000, null, 16),
  ('boat_duck', null, 80, 10),
  ('boat_lily', null, 140, 18),
  ('boat_pirate', null, 240, 26),
  ('boat_swan', null, 350, 36),
  ('hat_captain', 1500, null, 1),
  ('hat_crown', null, 150, 20),
  ('acc_vest', 1000, null, 1),
  ('acc_scarf', 600, null, 1),
  ('acc_backpack', 800, null, 1),
  ('acc_cat', null, 120, 1),
  ('hat_tophat', 1800, null, 1),
  ('hat_frog', null, 70, 1),
  ('acc_camera', 1200, null, 1),
  ('emote_dance', 1000, null, 1)
) as v(id, c, p, l) where i.id = v.id;

create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); it public.items; p public.profiles;
begin
  select * into it from public.items where id = p_item;
  if not found or it.source <> 'shop' then return jsonb_build_object('ok', false, 'reason', 'Not for sale.', 'state', public.get_state()); end if;
  select * into p from public.profiles where id = u for update;
  if p_item = any (p.owned) then return jsonb_build_object('ok', false, 'reason', 'You already own this.', 'state', public.get_state()); end if;
  if it.kind = 'boat' and p.level < 3 then return jsonb_build_object('ok', false, 'reason', 'Boats unlock at level 3.', 'state', public.get_state()); end if;
  if p.level < coalesce(it.min_level, 1) then return jsonb_build_object('ok', false, 'reason', 'Unlocks at level ' || it.min_level || '.', 'state', public.get_state()); end if;
  if coalesce(it.price_coins, 0) > p.coins then return jsonb_build_object('ok', false, 'reason', 'Not enough coins.', 'state', public.get_state()); end if;
  if coalesce(it.price_pearls, 0) > p.pearls then return jsonb_build_object('ok', false, 'reason', 'Not enough Pearls.', 'state', public.get_state()); end if;
  update public.profiles set coins = coins - coalesce(it.price_coins, 0), pearls = pearls - coalesce(it.price_pearls, 0),
    owned = owned || p_item, stats = public._inc(stats, 'purchases'), updated_at = now() where id = u;
  return jsonb_build_object('ok', true, 'item', p_item, 'state', public.get_state());
end $$;

-- 3) Bigger Hold floors follow the new upgrade prices (src/data/bait.js UPGRADES.hold).
create or replace function public.spend_coins(p_kind text, p_key text, p_coins int, p_pearls int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); p public.profiles; c int := greatest(0, coalesce(p_coins, 0)); pe int := greatest(0, coalesce(p_pearls, 0));
begin
  if p_kind not in ('bait', 'gear', 'upgrade', 'decor') then raise exception 'Unknown purchase'; end if;
  if char_length(coalesce(p_key, '')) not between 1 and 80 then raise exception 'Bad purchase key'; end if;
  if c > 100000 or pe > 1000 then raise exception 'Price out of range'; end if;
  -- hold upgrades raise the creel limit, so they have floor prices and must be bought in order
  if p_kind = 'upgrade' and p_key in ('hold1', 'hold2', 'hold3', 'hold4', 'hold5') then
    if (p_key = 'hold1' and c < 4000) or (p_key = 'hold2' and c < 10000) or (p_key = 'hold3' and c < 22000)
      or (p_key = 'hold4' and pe < 150) or (p_key = 'hold5' and pe < 270) then raise exception 'Bad price'; end if;
    if p_key <> 'hold1' and not exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = 'hold' || (substr(p_key, 5)::int - 1)) then raise exception 'Buy the levels in order'; end if;
    if exists (select 1 from public.purchases where user_id = u and kind = 'upgrade' and key = p_key) then return jsonb_build_object('ok', false, 'reason', 'Already bought.', 'state', public.get_state()); end if;
  end if;
  select * into p from public.profiles where id = u for update;
  if p.coins < c or p.pearls < pe then return jsonb_build_object('ok', false, 'reason', 'Not enough coins.', 'state', public.get_state()); end if;
  update public.profiles set coins = coins - c, pearls = pearls - pe, updated_at = now() where id = u;
  insert into public.purchases (user_id, kind, key, coins, pearls) values (u, p_kind, p_key, c, pe);
  return jsonb_build_object('ok', true, 'state', public.get_state());
end $$;

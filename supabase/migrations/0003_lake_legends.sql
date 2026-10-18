-- Lake Legends board: the three best fish anyone has ever caught (rarity first, then weight).
-- Read-only for players; computed from the catches table, so nothing new can be forged.
create index if not exists catches_trophy on public.catches (points desc, weight desc);

create or replace function public.top_trophies() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t order by t.rank), '[]'::jsonb) from (
    select row_number() over (order by c.points desc, c.weight desc, c.created_at asc) as rank,
      c.id, c.species_id as "speciesId", c.variant, c.weight, c.zone,
      p.display_name as name, c.user_id as "userId",
      (extract(epoch from c.created_at) * 1000)::bigint as ts
    from public.catches c join public.profiles p on p.id = c.user_id
    order by c.points desc, c.weight desc, c.created_at asc
    limit 3
  ) t;
$$;

grant execute on function public.top_trophies() to anon, authenticated;

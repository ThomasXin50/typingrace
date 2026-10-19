-- Liveness ("left" signal): a player whose connection is actually gone
-- should be removed from room_members entirely, not just locked out of
-- the current round (that's "stalled", a separate signal). Realtime
-- Presence can't safely trigger this - its state lives purely in-memory
-- on the Realtime websocket server, with no secure server-side way to
-- verify a claimed disconnect. Instead: a self-reported heartbeat
-- (last_seen_at, bumped only by the owning user - see
-- touch_room_member()) plus a periodic pg_cron sweep that removes anyone
-- stale. This is also exactly the periodic sweep DESIGN.md's "Hosting &
-- ops" section already calls for to clean up empty rooms, so it resolves
-- that separately-tracked roadmap item at the same time.

create extension if not exists pg_cron;

alter table public.room_members
  add column last_seen_at timestamptz not null default now();

create function public.touch_room_member(p_room_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.room_members
  set last_seen_at = now()
  where room_id = p_room_id and user_id = p_user_id;
$$;

revoke execute on function public.touch_room_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.touch_room_member(uuid, uuid) to service_role;

-- Sweeps a single room: removes every member who's gone stale (and their
-- participation in this room's currently active round, if any - the same
-- "left" cleanup leave-room does for a voluntary departure), then applies
-- leave-room's own host-transfer/room-delete rule, generalized from one
-- leaver to a whole batch going stale at once.
create function public.sweep_room_liveness(p_room_id uuid, p_stale_after interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_stale_ids uuid[];
  v_new_host uuid;
  v_active_round_id uuid;
begin
  select host_id into v_host_id from public.rooms where id = p_room_id;
  if v_host_id is null then
    return;
  end if;

  select array_agg(user_id) into v_stale_ids
  from public.room_members
  where room_id = p_room_id and last_seen_at < now() - p_stale_after;

  if v_stale_ids is null then
    return;
  end if;

  select id into v_active_round_id
  from public.rounds
  where room_id = p_room_id and status = 'active'
  limit 1;

  if v_active_round_id is not null then
    delete from public.round_participants
    where round_id = v_active_round_id and user_id = any (v_stale_ids);

    -- Same completion criterion as _shared/completeRound.ts (Deno) - an
    -- intentional second copy of this one-line check, not a third
    -- independently-evolving implementation of something bigger. See the
    -- room_liveness slice's plan for why: pg_cron runs pure SQL, so there's
    -- no runtime to share the TS helper with without disproportionate new
    -- infra (pg_net + an HTTP round trip) just to avoid one duplicated line.
    if not exists (
      select 1 from public.round_participants
      where round_id = v_active_round_id and status = 'racing'
    ) then
      update public.rounds
      set status = 'finished', ended_at = now()
      where id = v_active_round_id;

      update public.rooms set status = 'lobby' where id = p_room_id;
    end if;
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = any (v_stale_ids);

  if not exists (select 1 from public.room_members where room_id = p_room_id) then
    delete from public.rooms where id = p_room_id;
    return;
  end if;

  if v_host_id = any (v_stale_ids) then
    select user_id into v_new_host
    from public.room_members
    where room_id = p_room_id
    order by joined_at asc
    limit 1;

    update public.rooms set host_id = v_new_host where id = p_room_id;
  end if;
end;
$$;

revoke execute on function public.sweep_room_liveness(uuid, interval) from public, anon, authenticated;

create function public.sweep_all_stale_rooms(p_stale_after interval default interval '15 seconds')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct room_id from public.room_members
    where last_seen_at < now() - p_stale_after
  loop
    perform public.sweep_room_liveness(r.room_id, p_stale_after);
  end loop;
end;
$$;

revoke execute on function public.sweep_all_stale_rooms(interval) from public, anon, authenticated;

select cron.schedule(
  'sweep-stale-rooms',
  '10 seconds',
  $$ select public.sweep_all_stale_rooms(); $$
);

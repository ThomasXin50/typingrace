-- Authoritative bot race results. See src/features/multiplayer/CLAUDE.md
-- for the full simulation design - the short version: every connected
-- client simulates a bot's run independently and deterministically from
-- the same (round id, bot id) seed, so there is no server-side daemon and
-- no anti-cheat concern (a bot's score affects no real player's stats,
-- never touches solo_runs/leaderboards - see #66). The server's job here
-- is strictly concurrency-safety (assigning each finisher, human or bot,
-- a correct placement/field_size across BOTH populations), not re-
-- validating a client-reported number the way submit-round-run/
-- submit-solo-run do for humans.

-- The calibration input every client's simulation uses for a given round
-- (see calibrateBaseWpm in botSimulation.ts) - set once by start-race, so
-- every client reads the identical value rather than each computing its
-- own (which would make the simulation diverge across clients).
alter table public.rounds add column calibration_wpm numeric;

create table public.round_bot_results (
  round_id uuid not null references public.rounds (id) on delete cascade,
  bot_id uuid not null references public.room_bots (id) on delete cascade,
  personality text not null,
  wpm numeric not null,
  raw_wpm numeric not null,
  accuracy numeric not null,
  error_count integer not null,
  placement integer,
  field_size integer not null,
  created_at timestamptz not null default now(),
  primary key (round_id, bot_id)
);

alter table public.round_bot_results enable row level security;

create policy "room members can see the round's bot results"
  on public.round_bot_results for select
  using (
    exists (
      select 1 from public.rounds r
      where r.id = round_bot_results.round_id and public.is_room_member(r.room_id)
    )
  );

alter publication supabase_realtime add table public.round_bot_results;
alter table public.round_bot_results replica identity full;

-- Replaces finish_round_participant so a human's placement/field_size
-- accounts for bots too (a bot finishing 1st before any human means the
-- next human to finish is placed 2nd, not 1st). Switches its locking from
-- a round_participants row lock to an advisory lock keyed on the round -
-- the row lock alone no longer protects against a concurrent bot finish,
-- which touches a different table entirely.
create or replace function public.finish_round_participant(
  p_round_id uuid,
  p_user_id uuid,
  p_status text,
  p_validation_status text,
  p_wpm numeric,
  p_accuracy numeric
)
returns table (placement integer, field_size integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_placement integer;
  v_field_size integer;
begin
  select room_id into v_room_id from public.rounds where id = p_round_id;

  -- Serializes every finish (human or bot) for this round, so the two
  -- functions can never both read a stale finisher count.
  perform pg_advisory_xact_lock(hashtext(p_round_id::text));

  select
    (select count(*) from public.round_participants where round_id = p_round_id)
    + (select count(*) from public.room_bots where room_id = v_room_id)
  into v_field_size;

  if p_validation_status in ('verified', 'flagged') then
    select
      (select count(*) + 1 from public.round_participants
        where round_id = p_round_id and validation_status in ('verified', 'flagged'))
      + (select count(*) from public.round_bot_results where round_id = p_round_id)
    into v_placement;
  else
    v_placement := null;
  end if;

  update public.round_participants
  set
    status = p_status,
    validation_status = p_validation_status,
    wpm = p_wpm,
    accuracy = p_accuracy,
    placement = v_placement,
    field_size = v_field_size
  where round_id = p_round_id and user_id = p_user_id;

  return query select v_placement, v_field_size;
end;
$$;

-- Bot-side counterpart. Idempotent via the unique (round_id, bot_id) key:
-- a redundant call (two clients both noticing the same bot finish) does
-- nothing on the second call and just returns the already-assigned row,
-- rather than re-rolling a different placement.
create function public.finish_round_bot(
  p_round_id uuid,
  p_bot_id uuid,
  p_personality text,
  p_wpm numeric,
  p_raw_wpm numeric,
  p_accuracy numeric,
  p_error_count integer
)
returns table (placement integer, field_size integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.rounds where id = p_round_id;

  perform pg_advisory_xact_lock(hashtext(p_round_id::text));

  insert into public.round_bot_results
    (round_id, bot_id, personality, wpm, raw_wpm, accuracy, error_count, placement, field_size)
  select
    p_round_id, p_bot_id, p_personality, p_wpm, p_raw_wpm, p_accuracy, p_error_count,
    (select count(*) from public.round_participants
      where round_id = p_round_id and validation_status in ('verified', 'flagged'))
      + (select count(*) + 1 from public.round_bot_results where round_id = p_round_id),
    (select count(*) from public.round_participants where round_id = p_round_id)
      + (select count(*) from public.room_bots where room_id = v_room_id)
  on conflict (round_id, bot_id) do nothing;

  return query
    select rbr.placement, rbr.field_size
    from public.round_bot_results rbr
    where rbr.round_id = p_round_id and rbr.bot_id = p_bot_id;
end;
$$;

revoke execute on function public.finish_round_bot(uuid, uuid, text, numeric, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.finish_round_bot(uuid, uuid, text, numeric, numeric, numeric, integer) to service_role;

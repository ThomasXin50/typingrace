-- Multiplayer schema: rooms, room_members, rounds, round_participants.
-- See DESIGN.md's "Multiplayer: rooms and rounds" section for the full
-- rationale. No client insert/update policy on any of these four tables —
-- every write (room creation, joining, round lifecycle, results) goes
-- through a service-role Edge Function in later slices, the same
-- no-client-write-path pattern solo_runs already uses, needed here not just
-- for anti-cheat but for atomic capacity checks and a single synchronized
-- round start time.
--
-- Tables are all created up front, before any RLS policy, since rooms'
-- policy references room_members and Postgres won't resolve a forward
-- reference to a table that doesn't exist yet.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'racing')),
  max_players integer not null default 8 check (max_players between 2 and 10),
  difficulty_filter text not null default 'all'
    check (difficulty_filter in ('easy', 'normal', 'hard', 'all')),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'spectating')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_id_idx on public.room_members (user_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  text_id uuid not null references public.texts (id),
  status text not null default 'active' check (status in ('active', 'finished')),
  -- The synchronized start anchor every client's elapsed-time/wpm
  -- calculation is pinned to, set once at round creation - not each
  -- client's own local clock. The transient "countdown vs. actually
  -- racing" distinction is derived client-side from now() vs started_at,
  -- not stored as a separate status.
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index rounds_room_id_idx on public.rounds (room_id);

create table public.round_participants (
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'racing' check (status in ('racing', 'finished', 'stalled')),
  wpm numeric,
  accuracy numeric,
  -- null for a stalled participant: placement/field_size are computed from
  -- finishers only, per DESIGN.md's race-stats section.
  placement integer,
  field_size integer,
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.rounds enable row level security;
alter table public.round_participants enable row level security;

-- security definer, same pattern as is_admin(): room_members' own select
-- policy needs to check room_members membership, and a plain inline
-- subquery there would re-trigger that same policy on itself (infinite
-- recursion). Running the check as the function's owner sidesteps RLS for
-- this one lookup instead of recursing into it.
create function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

create policy "room members can see the room"
  on public.rooms for select
  using (public.is_room_member(id));

create policy "room members can see the roster"
  on public.room_members for select
  using (public.is_room_member(room_id));

create policy "room members can see the room's rounds"
  on public.rounds for select
  using (public.is_room_member(room_id));

-- Visibility spans every participant's row, not just the caller's own - the
-- live leaderboard and final results are the point of this table.
create policy "room members can see the round's participants"
  on public.round_participants for select
  using (
    exists (
      select 1 from public.rounds r
      where r.id = round_participants.round_id and public.is_room_member(r.room_id)
    )
  );

-- Postgres Changes needs these in the realtime publication so room/round
-- lifecycle events (join, leave, round start, round finish) reach clients,
-- per DESIGN.md. Live per-keystroke progress uses Broadcast instead (added
-- alongside the feature that needs it, not here) and is never written to
-- Postgres at all.
alter publication supabase_realtime add table
  public.rooms, public.room_members, public.rounds, public.round_participants;

-- Changed/deleted rows carry their full previous state in the Postgres
-- Changes payload, not just the primary key - clients need e.g. the
-- member who just left, not merely "a room_members row changed".
alter table public.rooms replica identity full;
alter table public.room_members replica identity full;
alter table public.rounds replica identity full;
alter table public.round_participants replica identity full;

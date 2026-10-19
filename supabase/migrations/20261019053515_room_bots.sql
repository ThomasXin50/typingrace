-- Multiplayer bots: room_bots, a room-scoped roster of host-added bot
-- opponents. See src/features/multiplayer/CLAUDE.md and
-- supabase/CLAUDE.md for the full rationale.
--
-- Deliberately not a public.profiles row: profiles.id has a hard FK to
-- auth.users (every profile is a real authenticated/anonymous session),
-- and a bot has no auth identity. This table is additive and never
-- touches room_members/round_participants' existing shape - the frontend
-- merges humans (room_members) and bots (room_bots) when rendering a
-- roster.

create table public.room_bots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  personality text not null
    check (personality in ('coder', 'typist', 'monkeytyper', 'typeracer')),
  created_at timestamptz not null default now()
);

create index room_bots_room_id_idx on public.room_bots (room_id);

alter table public.room_bots enable row level security;

-- No client insert/update/delete policy - same no-client-write-path
-- pattern every other multiplayer table uses. Only a service-role Edge
-- Function (add-room-bot, remove-room-bot, create-room's default-bot
-- seeding) ever writes a row here.
create policy "room members can see the room's bots"
  on public.room_bots for select
  using (public.is_room_member(room_id));

alter publication supabase_realtime add table public.room_bots;
alter table public.room_bots replica identity full;

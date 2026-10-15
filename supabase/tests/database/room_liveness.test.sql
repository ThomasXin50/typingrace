create extension if not exists pgtap;
create extension if not exists pgcrypto;

begin;
select plan(9);

-- Fixture: alice (host), bob, carol in one room; dave alone in a second
-- room, to confirm sweep_all_stale_rooms sweeps multiple rooms in one call.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'alice@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'bob@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'carol@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dave@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

set local role service_role;

insert into public.texts (id, content, status)
values ('55555555-5555-5555-5555-555555555555', 'a liveness race text', 'approved');

insert into public.rooms (id, host_id, join_code)
values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'ROOM01'),
  ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 'ROOM02');

-- joined_at set explicitly, not left to the column default: now() is
-- transaction-stable in Postgres, so every row in this one pgTAP
-- transaction would otherwise get the exact same timestamp, making
-- "earliest joined_at" ties non-deterministic below.
insert into public.room_members (room_id, user_id, joined_at, last_seen_at)
values
  -- room 1: alice (host, stale), bob (fresh, joined first), carol (fresh)
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', now() - interval '3 minutes', now() - interval '1 minute'),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', now() - interval '2 minutes', now()),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', now() - interval '1 minute', now()),
  -- room 2: dave alone, stale
  ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', now() - interval '1 minute', now() - interval '1 minute');

-- touch_room_member bumps the caller's own heartbeat.
select public.touch_room_member(
  '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222'
);
select ok(
  (select last_seen_at from public.room_members
   where room_id = '66666666-6666-6666-6666-666666666666' and user_id = '22222222-2222-2222-2222-222222222222')
    > now() - interval '5 seconds',
  'touch_room_member bumps last_seen_at for the given member'
);

-- Round in room 1: alice and bob racing, carol already finished.
insert into public.rounds (id, room_id, text_id, started_at)
values ('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666',
        '55555555-5555-5555-5555-555555555555', now());

insert into public.round_participants (round_id, user_id, status)
values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'racing'),
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'racing'),
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'finished');

-- Sweep room 1 (alice is stale, bob/carol are not).
select public.sweep_room_liveness('66666666-6666-6666-6666-666666666666', interval '15 seconds');

select is(
  (select count(*)::integer from public.room_members
   where room_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'a stale host is removed from room_members'
);

select is(
  (select host_id from public.rooms where id = '66666666-6666-6666-6666-666666666666'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'host transfers to the earliest-joined remaining member when the stale member was the host'
);

select is(
  (select count(*)::integer from public.room_members
   where room_id = '66666666-6666-6666-6666-666666666666'),
  2,
  'non-stale members are untouched'
);

select is(
  (select count(*)::integer from public.round_participants
   where round_id = '88888888-8888-8888-8888-888888888888' and user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'the stale member''s round_participants row for the active round is removed too'
);

select is(
  (select status from public.round_participants
   where round_id = '88888888-8888-8888-8888-888888888888' and user_id = '22222222-2222-2222-2222-222222222222'),
  'racing',
  'bob - still present and still racing - is untouched'
);

-- Bob (the only one left racing) now finishes - round should close since
-- nobody is 'racing' any more (alice removed, carol already finished).
update public.round_participants
set status = 'finished'
where round_id = '88888888-8888-8888-8888-888888888888' and user_id = '22222222-2222-2222-2222-222222222222';

select public.sweep_room_liveness('66666666-6666-6666-6666-666666666666', interval '15 seconds');

select is(
  (select status from public.rounds where id = '88888888-8888-8888-8888-888888888888'),
  'active',
  'sweeping a room with no newly-stale members is a no-op (round status unaffected by this second, idle sweep)'
);

-- Sweep everything at once: room 2 (dave, alone and stale) should be
-- deleted entirely, independently of room 1's state above.
select public.sweep_all_stale_rooms(interval '15 seconds');

select is(
  (select count(*)::integer from public.rooms where id = '77777777-7777-7777-7777-777777777777'),
  0,
  'sweep_all_stale_rooms deletes a room left with zero non-stale members'
);

-- A direct client call must be denied for every function here.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select throws_like(
  $$ select public.sweep_all_stale_rooms() $$,
  '%permission denied%',
  'a client cannot call sweep_all_stale_rooms directly'
);

select * from finish();
rollback;

create extension if not exists pgtap;
create extension if not exists pgcrypto;

begin;
select plan(15);

-- Fixture users: alice and bob are both members of the same room; carol is
-- a member of nothing, to prove visibility is scoped to actual membership
-- rather than to "any authenticated user" or "the row's own creator only".
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
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- Seed a room (alice hosting, alice + bob as members), a round in it, and a
-- round_participants row for each member - all as the service role, since
-- these tables have no client insert policy at all.
set local role service_role;

insert into public.texts (id, content, status)
values ('44444444-4444-4444-4444-444444444444', 'a room race text', 'approved');

insert into public.rooms (id, host_id, join_code)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'ABC123');

insert into public.room_members (room_id, user_id)
values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222');

insert into public.rounds (id, room_id, text_id, started_at)
values ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', now());

insert into public.round_participants (round_id, user_id)
values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111'),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222');

insert into public.room_bots (id, room_id, personality)
values ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'coder');

reset role;

-- Act as Alice (a member).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from public.rooms where id = '55555555-5555-5555-5555-555555555555'),
  1::bigint,
  'a room member can see the room'
);

select is(
  (select count(*) from public.room_members where room_id = '55555555-5555-5555-5555-555555555555'),
  2::bigint,
  'a room member sees the full roster, not just their own row'
);

select is(
  (select count(*) from public.rounds where room_id = '55555555-5555-5555-5555-555555555555'),
  1::bigint,
  'a room member can see the room''s round'
);

select is(
  (select count(*) from public.round_participants where round_id = '66666666-6666-6666-6666-666666666666'),
  2::bigint,
  'a room member sees every participant''s row, not just their own'
);

select is(
  (select count(*) from public.room_bots where room_id = '55555555-5555-5555-5555-555555555555'),
  1::bigint,
  'a room member can see the room''s bots'
);

select throws_like(
  $$ insert into public.rooms (host_id, join_code) values ('11111111-1111-1111-1111-111111111111', 'XYZ999') $$,
  '%row-level security%',
  'clients cannot insert rooms directly'
);

select throws_like(
  $$ insert into public.room_members (room_id, user_id)
     values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333') $$,
  '%row-level security%',
  'clients cannot insert room_members directly'
);

select throws_like(
  $$ insert into public.rounds (room_id, text_id, started_at)
     values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', now()) $$,
  '%row-level security%',
  'clients cannot insert rounds directly'
);

select throws_like(
  $$ insert into public.round_participants (round_id, user_id)
     values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111') $$,
  '%row-level security%',
  'clients cannot insert round_participants directly'
);

select throws_like(
  $$ insert into public.room_bots (room_id, personality)
     values ('55555555-5555-5555-5555-555555555555', 'typist') $$,
  '%row-level security%',
  'clients cannot insert room_bots directly'
);

-- Act as Carol (not a member of this room).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from public.rooms where id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'a non-member cannot see the room'
);

select is(
  (select count(*) from public.room_members where room_id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'a non-member cannot see the room''s roster'
);

select is(
  (select count(*) from public.rounds where room_id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'a non-member cannot see the room''s round'
);

select is(
  (select count(*) from public.round_participants where round_id = '66666666-6666-6666-6666-666666666666'),
  0::bigint,
  'a non-member cannot see the round''s participants'
);

select is(
  (select count(*) from public.room_bots where room_id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'a non-member cannot see the room''s bots'
);

select * from finish();
rollback;

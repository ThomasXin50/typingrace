create extension if not exists pgtap;
create extension if not exists pgcrypto;

begin;
select plan(8);

-- Fixture: alice, bob, carol all racing in the same round.
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

set local role service_role;

insert into public.texts (id, content, status)
values ('44444444-4444-4444-4444-444444444444', 'a round race text', 'approved');

insert into public.rooms (id, host_id, join_code)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'ABC123');

insert into public.rounds (id, room_id, text_id, started_at)
values ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', now());

insert into public.round_participants (round_id, user_id)
values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111'),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222'),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333');

-- Alice finishes first.
select results_eq(
  $$ select placement, field_size from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
       'finished', 'verified', 80, 98
     ) $$,
  $$ values (1, 3) $$,
  'the first verified finisher gets placement 1, field_size is the full enrolled count'
);

-- Carol's run gets rejected by anti-cheat - no placement, doesn't block bob's.
select results_eq(
  $$ select placement, field_size from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
       'finished', 'rejected', 999, 100
     ) $$,
  $$ values (null::integer, 3) $$,
  'a rejected run gets no placement, but field_size still reflects everyone enrolled'
);

-- Bob finishes after carol's (rejected) submission - still placement 2, not 3.
select results_eq(
  $$ select placement, field_size from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222',
       'finished', 'verified', 70, 95
     ) $$,
  $$ values (2, 3) $$,
  'placement counts only verified/flagged finishers - a rejected run does not consume a slot'
);

select is(
  (select status from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  'finished',
  'finish_round_participant updates the participant''s own status'
);

select is(
  (select wpm from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  80::numeric,
  'finish_round_participant records the computed wpm'
);

select is(
  (select validation_status from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '33333333-3333-3333-3333-333333333333'),
  'rejected',
  'finish_round_participant records the validation outcome'
);

-- A direct client call (not the service role) must be denied - only the
-- anti-cheat Edge Function may assign results.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select throws_like(
  $$ select * from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
       'finished', 'verified', 9999, 100
     ) $$,
  '%permission denied%',
  'a client cannot call finish_round_participant directly to self-report a result'
);

set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_like(
  $$ select * from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
       'finished', 'verified', 9999, 100
     ) $$,
  '%permission denied%',
  'anon cannot call it either'
);

select * from finish();
rollback;

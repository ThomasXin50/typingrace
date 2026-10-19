create extension if not exists pgtap;
create extension if not exists pgcrypto;

begin;
select plan(6);

-- Fixture: alice and bob racing in the same round.
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
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222');

select public.stall_round_participant(
  '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111'
);

select is(
  (select status from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  'stalled',
  'stall_round_participant marks a racing participant as stalled'
);

select is(
  (select placement from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  null::integer,
  'a stalled participant gets no placement'
);

-- Bob finishes normally - unaffected by alice's stall.
select results_eq(
  $$ select placement, field_size from public.finish_round_participant(
       '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222',
       'finished', 'verified', 70, 95
     ) $$,
  $$ values (1, 2) $$,
  'a stalled participant does not block or shift another finisher''s placement'
);

-- Calling stall again on alice (already stalled) is a harmless no-op.
select public.stall_round_participant(
  '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111'
);

select is(
  (select status from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '11111111-1111-1111-1111-111111111111'),
  'stalled',
  'calling stall_round_participant again on an already-stalled row is a no-op'
);

-- Calling stall on bob (already finished) must not un-finish him.
select public.stall_round_participant(
  '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222'
);

select is(
  (select status from public.round_participants
   where round_id = '66666666-6666-6666-6666-666666666666' and user_id = '22222222-2222-2222-2222-222222222222'),
  'finished',
  'stall_round_participant cannot un-finish an already-finished participant'
);

-- A direct client call must be denied - only the service-role Edge
-- Function may report a stall.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select throws_like(
  $$ select public.stall_round_participant(
       '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111'
     ) $$,
  '%permission denied%',
  'a client cannot call stall_round_participant directly - not even to stall someone else'
);

select * from finish();
rollback;

create extension if not exists pgtap;
create extension if not exists pgcrypto;

begin;
select plan(11);

-- Fixture users (direct auth.users insert so the on_auth_user_created
-- trigger provisions a matching profiles row for each).
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token,
   is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'alice@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'bob@example.com', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000',
   '77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated',
   null, null, now(),
   '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now(), '', '', '', '', true);

-- Seed one approved and one pending text as the service role (bypasses RLS).
set local role service_role;
insert into public.texts (id, content, status, submitted_by)
values
  ('33333333-3333-3333-3333-333333333333', 'the quick brown fox', 'approved', null),
  ('44444444-4444-4444-4444-444444444444', 'alice''s pending submission', 'pending', '11111111-1111-1111-1111-111111111111');

insert into public.solo_runs (id, user_id, text_id, wpm, raw_wpm, accuracy, duration_ms, validation_status)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333', 80, 85, 98, 20000, 'verified');
reset role;

-- Act as Alice (authenticated).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select throws_like(
  $$ insert into public.solo_runs (user_id, text_id, wpm, raw_wpm, accuracy, duration_ms, validation_status)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 999, 999, 100, 1000, 'verified') $$,
  '%row-level security%',
  'clients cannot insert solo_runs directly'
);

select is(
  (select count(*) from public.solo_runs where user_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'alice can see her own solo run'
);

select is(
  (select count(*) from public.solo_runs where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'alice cannot see a run that is not hers (none exist for bob here, confirming scoping not a wildcard)'
);

select throws_like(
  $$ insert into public.texts (content, status, submitted_by)
     values ('shortcut to approved', 'approved', '11111111-1111-1111-1111-111111111111') $$,
  '%row-level security%',
  'a submission cannot self-approve at insert time'
);

select throws_like(
  $$ insert into public.texts (content, status, submitted_by)
     values ('impersonation attempt', 'pending', '22222222-2222-2222-2222-222222222222') $$,
  '%row-level security%',
  'a user cannot submit a text attributed to someone else'
);

select lives_ok(
  $$ insert into public.texts (content, status, submitted_by)
     values ('a legitimate submission', 'pending', '11111111-1111-1111-1111-111111111111') $$,
  'a user can submit their own text as pending'
);

select throws_like(
  $$ update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111' $$,
  '%service-role action%',
  'a user cannot self-escalate to admin'
);

-- Act as anonymous.
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select is(
  (select count(*) from public.texts where id = '33333333-3333-3333-3333-333333333333'),
  1::bigint,
  'anon can see the approved fixture text'
);

select is(
  (select count(*) from public.texts where id = '44444444-4444-4444-4444-444444444444'),
  0::bigint,
  'anon cannot see a pending text that is not theirs'
);

select is(
  (select is_anonymous from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  true,
  'handle_new_user propagates is_anonymous from auth.users to the profile row'
);

select is(
  (select is_anonymous from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  false,
  'a real (non-anonymous) signup is recorded as such on the profile row'
);

select * from finish();
rollback;

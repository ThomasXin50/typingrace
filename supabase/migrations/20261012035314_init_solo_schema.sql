-- Solo-mode schema: profiles, texts, solo_runs.
-- See DESIGN.md for the full rationale (texts tiers, anti-cheat write path,
-- difficulty calibration).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- New auth.users rows (including anonymous sign-ins) get a profile row.
-- security definer: the auth schema's own trigger context has no grant to
-- insert into public.profiles otherwise, since profiles has RLS enabled and
-- no insert policy for arbitrary rows.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'user_' || replace(new.id::text, '-', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Changing role is deliberately not reachable through the normal update
-- policy above: only a service-role actor (a trusted backend process) can
-- promote/demote. Prevents client-side self-escalation to admin.
create function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'role can only be changed by a service-role action';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

create function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table public.texts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  language text not null default 'en',
  category text not null default 'quote',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  difficulty_rating numeric not null default 1200,
  difficulty_source text not null default 'heuristic' check (difficulty_source in ('heuristic', 'calibrated')),
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index texts_status_idx on public.texts (status);
create index texts_submitted_by_idx on public.texts (submitted_by);

alter table public.texts enable row level security;

create policy "approved texts are public, others visible to owner/admin"
  on public.texts for select
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or public.is_admin()
  );

create policy "users submit their own texts as pending"
  on public.texts for insert
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
  );

create policy "admins moderate texts"
  on public.texts for update
  using (public.is_admin());

create table public.solo_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_id uuid not null references public.texts (id),
  wpm numeric not null check (wpm >= 0),
  raw_wpm numeric not null check (raw_wpm >= 0),
  accuracy numeric not null check (accuracy between 0 and 100),
  consistency numeric,
  duration_ms integer not null check (duration_ms > 0),
  error_count integer not null default 0,
  validation_status text not null check (validation_status in ('verified', 'flagged', 'rejected')),
  created_at timestamptz not null default now()
);

create index solo_runs_user_id_created_at_idx on public.solo_runs (user_id, created_at desc);
create index solo_runs_text_id_wpm_idx on public.solo_runs (text_id, wpm desc);

alter table public.solo_runs enable row level security;

create policy "users and admins can read solo runs"
  on public.solo_runs for select
  using (user_id = auth.uid() or public.is_admin());

-- No insert/update/delete policy: this table is only ever written by the
-- service role (the future anti-cheat Edge Function). A client JWT can
-- never write a result directly, regardless of grants.

-- Leaderboard views intentionally run as their owner (security_invoker
-- defaults to false), not the querying user: they aggregate across every
-- user's solo_runs, which the base table's RLS would otherwise restrict to
-- "own rows only". Only approved texts and verified runs are counted.
create view public.leaderboard_global as
select
  user_id,
  username,
  runs,
  avg_wpm,
  best_wpm,
  rank() over (order by best_wpm desc) as rank
from (
  select
    p.id as user_id,
    p.username,
    count(*) as runs,
    round(avg(sr.wpm), 2) as avg_wpm,
    max(sr.wpm) as best_wpm
  from public.solo_runs sr
  join public.texts t on t.id = sr.text_id and t.status = 'approved'
  join public.profiles p on p.id = sr.user_id
  where sr.validation_status = 'verified'
  group by p.id, p.username
) ranked;

grant select on public.leaderboard_global to anon, authenticated;

create view public.leaderboard_by_text as
select
  text_id,
  user_id,
  username,
  best_wpm,
  rank() over (partition by text_id order by best_wpm desc) as rank
from (
  select
    sr.text_id,
    p.id as user_id,
    p.username,
    max(sr.wpm) as best_wpm
  from public.solo_runs sr
  join public.texts t on t.id = sr.text_id and t.status = 'approved'
  join public.profiles p on p.id = sr.user_id
  where sr.validation_status = 'verified'
  group by sr.text_id, p.id, p.username
) ranked;

grant select on public.leaderboard_by_text to anon, authenticated;

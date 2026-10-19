-- Denormalizes auth.users.is_anonymous onto public.profiles. Needed because
-- anonymity is session/auth-level data; a view or query can't otherwise see
-- whether some OTHER user's profile is anonymous, which the leaderboard
-- (and, later, multiplayer room rosters/results) needs in order to display
-- "Guest" instead of a generated username. See DESIGN.md's Auth section.

alter table public.profiles add column is_anonymous boolean not null default false;

update public.profiles p
set is_anonymous = u.is_anonymous
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, is_anonymous)
  values (new.id, 'user_' || replace(new.id::text, '-', ''), coalesce(new.is_anonymous, false));
  return new;
end;
$$;

-- is_anonymous appended at the end of each view's column list - a
-- create-or-replace-view can add columns but not reorder/insert them among
-- the existing ones.
create or replace view public.leaderboard_global as
select
  user_id,
  username,
  runs,
  avg_wpm,
  best_wpm,
  rank() over (order by best_wpm desc) as rank,
  is_anonymous
from (
  select
    p.id as user_id,
    p.username,
    count(*) as runs,
    round(avg(sr.wpm), 2) as avg_wpm,
    max(sr.wpm) as best_wpm,
    p.is_anonymous
  from public.solo_runs sr
  join public.texts t on t.id = sr.text_id and t.status = 'approved'
  join public.profiles p on p.id = sr.user_id
  where sr.validation_status = 'verified'
  group by p.id, p.username, p.is_anonymous
) ranked;

create or replace view public.leaderboard_by_text as
select
  text_id,
  user_id,
  username,
  best_wpm,
  rank() over (partition by text_id order by best_wpm desc) as rank,
  is_anonymous
from (
  select
    sr.text_id,
    p.id as user_id,
    p.username,
    max(sr.wpm) as best_wpm,
    p.is_anonymous
  from public.solo_runs sr
  join public.texts t on t.id = sr.text_id and t.status = 'approved'
  join public.profiles p on p.id = sr.user_id
  where sr.validation_status = 'verified'
  group by sr.text_id, p.id, p.username, p.is_anonymous
) ranked;

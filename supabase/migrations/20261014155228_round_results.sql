-- Race result submission: validation_status on round_participants (the
-- same verified|flagged|rejected outcome solo_runs already tracks) and a
-- concurrency-safe function to assign placement/field_size. See DESIGN.md's
-- "Multiplayer: rooms and rounds" and "Leaderboards & stats" sections.

alter table public.round_participants
  add column validation_status text check (validation_status in ('verified', 'flagged', 'rejected'));

-- security definer so it can write to round_participants (no client write
-- policy exists on it, same as every other multiplayer table) - but unlike
-- is_room_member()/is_admin() (read-only membership checks, safe for any
-- caller), this one WRITES a race result, so public's default execute
-- grant is revoked immediately below: only the service-role anti-cheat
-- Edge Function may call it, never a client self-reporting its own result.
create function public.finish_round_participant(
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
  v_placement integer;
  v_field_size integer;
begin
  -- Locks every participant row for this round before counting, so two
  -- players finishing within milliseconds of each other can't both read
  -- the same finisher count and collide on the same placement - the
  -- second caller blocks here until the first transaction commits.
  perform 1 from public.round_participants where round_id = p_round_id for update;

  select count(*) into v_field_size
  from public.round_participants
  where round_id = p_round_id;

  if p_validation_status in ('verified', 'flagged') then
    select count(*) + 1 into v_placement
    from public.round_participants
    where round_id = p_round_id and validation_status in ('verified', 'flagged');
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

-- Supabase's default privileges grant execute on new public-schema
-- functions to anon/authenticated directly (not just via `public`), so
-- both need an explicit revoke here, not just `from public`.
revoke execute on function public.finish_round_participant(uuid, uuid, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.finish_round_participant(uuid, uuid, text, text, numeric, numeric) to service_role;

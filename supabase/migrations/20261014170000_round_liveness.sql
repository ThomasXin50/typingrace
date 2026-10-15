-- Liveness (stalled signal): a security-definer function that locks a
-- still-racing participant out of their round once a client has detected
-- 10s with no keystroke. See DESIGN.md's "Liveness" section. Far simpler
-- than finish_round_participant - no placement/field_size to compute, no
-- cross-row locking needed (a single-row update is already atomic), and
-- the `status = 'racing'` guard alone makes repeat calls idempotent: a
-- finisher can't be un-finished, and an already-stalled row is left alone.

create function public.stall_round_participant(p_round_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.round_participants
  set status = 'stalled'
  where round_id = p_round_id and user_id = p_user_id and status = 'racing';
$$;

-- Supabase's default privileges grant execute on new public-schema
-- functions to anon/authenticated directly (not just via `public`), so
-- both need an explicit revoke here, not just `from public` - same gotcha
-- as finish_round_participant. Only the service-role Edge Function may
-- call this; a client reporting its own id is never trusted to self-report
-- being stalled (or, worse, someone else's).
revoke execute on function public.stall_round_participant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.stall_round_participant(uuid, uuid) to service_role;

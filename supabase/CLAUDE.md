# Supabase backend

Backend-specific detail that only matters while working in this folder. See
the root `CLAUDE.md` for the project-wide process (issues, PRs, red-green).

## Edge Functions (`functions/`)

- One folder per function, Deno runtime. Each gets its own `deno.json`.
- Split pure logic out of `index.ts` into a small same-folder module (e.g.
  `joinCode.ts`, `canJoin.ts`, `rateLimit.ts`, `leaveRoom.ts`) with its own
  `<name>.test.ts` — `index.ts` itself stays thin (request parsing +
  wiring) and isn't unit-tested directly.
- Shared logic across functions lives in `functions/_shared/` (`validate.ts`,
  `completeRound.ts`).
- Test with Deno's built-in runner: `deno test --no-check supabase/functions`
  (matches the `functions-tests` CI job) — not Vitest.

## The anti-cheat contract: `_shared/validate.ts` <-> the client engine

`functions/_shared/validate.ts`'s `computeStats()` is a line-for-line mirror
of the frontend's `src/features/typing/useTypingEngine.ts`'s internal
`replay()`: same continue-through-errors model, same finish-lock (every
event after the text completes, including a trailing backspace, is
ignored), same `effectiveStart ?? firstTimestamp` elapsed-time rule. This
is deliberate, not incidental duplication — it's what guarantees the
live client-side preview a player sees can never silently disagree with
the server-authoritative result that actually gets stored. **Changing the
replay/scoring logic on one side without the other breaks that guarantee**
— treat them as one algorithm that happens to be written twice, and change
both together.

`assessValidation()` is the anti-cheat layer on top of that: a run lands in
`solo_runs.validation_status` / the equivalent round-result status as
`'verified' | 'flagged' | 'rejected'`. Untrusted (scripted) keystrokes or an
unfinished run are rejected outright; a WPM over the ceiling (currently 250) or suspiciously uniform keystroke timing (coefficient of variation
under the threshold, and only once there are enough intervals to judge) is
flagged for review rather than silently banned — mirrors a
"confirm-via-challenge" posture, not a hard ban on a single heuristic.
Never trust a client-submitted wpm/accuracy value as pre-validated.

## Migrations (`migrations/`)

- Filename: `<UTC timestamp>_<description>.sql`, matching
  `supabase migration new <description>`'s own naming.
- Additive and forward-only — this project doesn't hand-edit or squash past
  migrations.

## Database tests (`tests/database/`)

- pgTAP, run via `supabase test db` (matches the `db-tests` CI job).
- RLS policies get real SQL-level tests (e.g. "user A cannot select user
  B's `solo_runs` row"), not just application-level assumptions.

## After a merge that touches this folder

- Migrations or Edge Function changes need a manual, explicit step after
  merge — CI does not auto-deploy either: `supabase db push` for
  migrations, `supabase functions deploy <name>` for a changed function.
  Confirm with the user before running either against the linked project;
  both affect the live shared database/backend, not just this checkout.
- A PR that touches only the frontend needs neither step — Vercel's normal
  auto-deploy from `dev`/`main` covers it.

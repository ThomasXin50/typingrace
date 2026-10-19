---
paths:
  - 'supabase/**'
---

# Supabase backend conventions

Backend-specific detail that only matters while touching `supabase/`. See
root `CLAUDE.md` for the project-wide process (issues, PRs, red-green).

## Edge Functions (`supabase/functions/`)

- One folder per function, Deno runtime. Each gets its own `deno.json`.
- Split pure logic out of `index.ts` into a small same-folder module (e.g.
  `joinCode.ts`, `canJoin.ts`, `rateLimit.ts`, `leaveRoom.ts`) with its own
  `<name>.test.ts` — `index.ts` itself stays thin (request parsing +
  wiring) and isn't unit-tested directly.
- Shared logic across functions lives in `supabase/functions/_shared/`
  (e.g. `validate.ts`, `completeRound.ts`).
- Test with Deno's built-in runner: `deno test --no-check supabase/functions`
  (matches the `functions-tests` CI job) — not Vitest.
- Server-authoritative anti-cheat: `solo_runs.validation_status` is
  `'verified' | 'flagged' | 'rejected'`, decided server-side in the submit
  path (WPM ceiling, keystroke-timing-uniformity check). Never trust a
  client-submitted wpm/accuracy value as pre-validated.

## Migrations (`supabase/migrations/`)

- Filename: `<UTC timestamp>_<description>.sql`, matching
  `supabase migration new <description>`'s own naming.
- Additive and forward-only — this project doesn't hand-edit or squash past
  migrations.

## Database tests (`supabase/tests/database/`)

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

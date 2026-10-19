# typingrace

Typing-speed-test web app — React 19 + TypeScript + Vite frontend, Supabase
(Postgres, Auth, Realtime, Edge Functions) backend, deployed to Vercel. Built
as a portfolio piece: the process discipline below is as much the point as
the code.

- Product scope and decisions: `PRODUCT.md`
- Visual design system (tokens, components): `DESIGN.md`
- Read both on demand when the task needs them — they aren't summarized here.

## Structure

- `src/features/<name>/` — one feature per folder: component(s), hooks,
  `.css`, and co-located `.test.tsx`/`.test.ts` files, side by side. No
  global `components/`, `hooks/`, or `types/` buckets.
- `src/app/` — app shell: router, nav, theme.
- `src/lib/` — small cross-feature utilities (e.g. `formatElapsed`,
  `displayName`, the Supabase client).
- `supabase/functions/` — Edge Functions (Deno), one folder per function.
  Backend-specific conventions: `.claude/rules/supabase.md` (loads
  automatically when you touch this folder).
- `supabase/migrations/` — SQL migrations, timestamp-prefixed.
- `supabase/tests/database/` — pgTAP tests (RLS, triggers).

## Branching

- `main` is protected and always deployable — Vercel's production
  deployment tracks it. Nothing is committed to `main` directly; it only
  moves forward via a merge from `dev` at a release point.
- `dev` is the integration branch. Every feature/fix branch is cut from
  `dev` and PRs back into `dev`.
- Branch naming: `<issue-number>-short-description` (e.g. `42-solo-run-rls`).

## Issues and PRs

- **Every change gets a GitHub issue first** — no exceptions, including
  trivial fixes. The issue states what's wrong/needed and why, before any
  branch exists.
- **Every change goes through a pull request**, even solo. The PR links its
  issue (`Closes #42`) and gets self-reviewed before merging — treat it as
  though a reviewer who wasn't in your head while you wrote it has to be
  able to follow the diff.
- Squash-merge into `dev` so each merged PR is one clean commit on the
  integration branch; `dev` → `main` release merges keep a merge commit so
  release boundaries stay visible in history.
- Commit messages and PR titles: [Conventional Commits](https://www.conventionalcommits.org/)
  style (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`), referencing the
  issue number.
- **Merging a PR always needs the user's own action or explicit sign-off in
  chat** — the auto-mode permission classifier blocks an agent-run
  `gh pr merge`. Get the PR green and report it as ready; don't keep
  retrying the merge.
- The full issue → branch → PR → CI loop is a project skill — see
  `ship-feature` (`.claude/skills/ship-feature/SKILL.md`).

## Testing — red-green, before the code

- Write or update the failing test **before** writing the implementation
  (red), then write the minimum code to pass it (green), then refactor with
  the suite green throughout. This applies to every change, not just new
  features — a bug fix starts with a test that reproduces the bug.
- Stack: Vitest + React Testing Library (frontend), Deno's test runner
  (Edge Functions — see `.claude/rules/supabase.md`), pgTAP (Postgres/RLS).
- CI runs the full suite on every PR with an **80% coverage gate**. A
  failing test or a coverage drop below 80% blocks the merge.
- Before committing, run locally: `npx vitest run`, `npx eslint .`,
  `npx tsc --noEmit -p .`, `npx prettier --check .`.

## Comments and documentation

- Default to no comments. Well-named identifiers and small functions should
  make the _what_ obvious without narration.
- Write a comment only when it explains something the code can't: a hidden
  constraint, a non-obvious invariant, a workaround for a specific bug, or a
  reason a reader would otherwise have to go dig for.
- Never write comments that restate what the code does, reference the
  current task/issue number, or explain history ("removed X", "changed from
  Y") — that belongs in the commit message and PR description, not the file.

## Code organization and style

- Organize by feature, not by type (see Structure above).
- Linting/formatting: ESLint + Prettier, enforced in CI — style arguments
  don't happen in review, the tool decides.
- Prefer small, single-purpose modules over large multi-responsibility
  files; a file doing two unrelated things is a sign it should split.
- No dead code, commented-out code, or speculative abstractions for
  hypothetical future needs — if it's not used by the current feature, it
  doesn't go in.

## Git hygiene

- Never stage `.agents/`, `.claude/`, root `deno.lock`, or `skills-lock.json`
  (tool-local state, already gitignored) — add files explicitly rather than
  `git add -A`/`.`.

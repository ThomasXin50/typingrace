# Development Rules

Process and style conventions for this repo. These apply to every change,
including solo work — the discipline itself is part of what this portfolio
project is meant to demonstrate.

## Branching

- `main` is protected and always deployable — Vercel's production deployment
  tracks it. Nothing is committed to `main` directly; it only moves forward
  via a merge from `dev` at a release point.
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

## Testing — red-green, before the code

- Write or update the failing test **before** writing the implementation
  (red), then write the minimum code to pass it (green), then refactor with
  the suite green throughout. This applies to every change, not just new
  features — a bug fix starts with a test that reproduces the bug.
- Stack:
  - Frontend: Vitest + React Testing Library.
  - Edge Functions: Deno's built-in test runner.
  - Postgres/RLS: pgTAP — RLS policies get real SQL-level tests (e.g. "user
    A cannot select user B's `solo_runs` row"), not just application-level
    assumptions.
- CI (GitHub Actions) runs the full suite on every PR with an **80%
  coverage gate**. A failing test or a coverage drop below 80% blocks the
  merge — this is enforced, not advisory.

## Comments and documentation

- Default to no comments. Well-named identifiers and small functions should
  make the *what* obvious without narration.
- Write a comment only when it explains something the code can't: a hidden
  constraint, a non-obvious invariant, a workaround for a specific bug, or a
  reason a reader would otherwise have to go dig for.
- Never write comments that restate what the code does, reference the
  current task/issue number, or explain history ("removed X", "changed from
  Y") — that belongs in the commit message and PR description, not the file.

## Code organization and style

- Organize by feature, not by type — e.g. `src/features/race/` holding its
  components, hooks, and types together, rather than global `components/`,
  `hooks/`, `types/` buckets.
- Linting/formatting: ESLint + Prettier, enforced in CI (same PR check as
  tests) — style arguments don't happen in review, the tool decides.
- Prefer small, single-purpose modules over large multi-responsibility
  files; a file doing two unrelated things is a sign it should split.
- No dead code, commented-out code, or speculative abstractions for
  hypothetical future needs — if it's not used by the current feature, it
  doesn't go in.

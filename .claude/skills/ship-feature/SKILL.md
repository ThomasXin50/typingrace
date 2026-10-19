---
name: ship-feature
description: Use when starting, implementing, or shipping any feature, fix, or chore in this repo (typingrace) - the standard issue -> branch -> red/green -> PR -> CI loop every change here follows, including this skill's own edits.
---

# Shipping a change in typingrace

This repo's process (`CLAUDE.md`) applies to every change, including
trivial ones. This skill is that process as a runnable checklist, so it
doesn't need to be re-derived each time.

1. **Issue first.** `gh issue create` stating what's wrong/needed and why.
   No branch before the issue exists.
2. **Branch from `dev`**: `git checkout dev && git pull` then
   `git checkout -b <issue-number>-short-description`.
3. **Red, then green.** Write/update the failing test before the
   implementation. Frontend: Vitest + React Testing Library. Edge
   Functions / Postgres: see `.claude/rules/supabase.md`.
4. **Verify locally before committing** (all must pass):
   - `npx vitest run`
   - `npx eslint .`
   - `npx tsc --noEmit -p .`
   - `npx prettier --check .`
   - For UI-touching changes, run the Impeccable design detector on the
     changed files before committing.
   - For a live-browser-verifiable UI change, actually exercise it in the
     browser (dev server, `localhost:5173`) before calling it done.
5. **Stage explicitly** — list files by name, never `git add -A`/`.`.
   Never stage `.agents/`, `.claude/scheduled_tasks.lock`,
   `.claude/settings.local.json`, root `deno.lock`, or `skills-lock.json`
   (all gitignored local tool state).
6. **Commit**: Conventional Commits style (`feat:`, `fix:`, `test:`,
   `refactor:`, `chore:`), referencing the issue number, via a heredoc
   message. End with the attribution line from this session's system
   reminder (not a hardcoded one here - it can change).
7. **Push and open the PR**: `git push -u origin <branch>`, then
   `gh pr create --base dev` with a title/body following the same
   Conventional Commits + `Closes #<n>` convention, ending with this
   session's PR attribution line.
8. **Watch CI**: `gh pr checks <n> --watch`. Fix and push again on
   failure, same branch.
9. **Stop before merging.** `gh pr merge` from an agent is blocked by the
   auto-mode permission classifier by design - this is not a bug to route
   around. Once CI is green, report the PR as ready and let the user merge
   it (or explicitly do it themselves).
10. **After merge**, if the change touched `supabase/migrations/` or
    `supabase/functions/`, see the "After a merge" section of
    `.claude/rules/supabase.md` - that deploy step is manual and needs
    separate confirmation, it does not happen as part of this flow.

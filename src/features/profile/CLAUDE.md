# Profile

Aggregate stats, recent-run history, and account settings (username,
theme).

## `RunsTrendChart` / `runsTrendChartMath.ts`

- Only plots runs with `validationStatus === 'verified'` — flagged/rejected
  runs' wpm values aren't trustworthy signal to chart alongside real ones,
  even though they still show up (with their status labeled) in the plain
  history table below the chart.
- Needs at least `MIN_POINTS = 3` verified runs before it renders anything
  (a one- or two-point "trend" isn't one).
- Chronological order (oldest to newest, left to right — a "progress over
  time" read), the opposite of `useRecentRuns`' newest-first order used by
  the history table, so the chart reverses the list it's given rather than
  assuming a particular incoming order.
- **See `src/features/typing/CLAUDE.md`** for why this module's math is a
  deliberately separate, non-DRY sibling of `wpmChartMath.ts` (different
  x-axis semantics, different y-axis scaling) — don't try to merge them.

## History table (`ProfilePage.tsx`)

- A verified run gets no status label at all in the wpm column — only the
  exception (flagged/rejected) is called out. Absence of a label _is_ the
  "this one's trustworthy" signal; don't add a redundant "verified" badge.
- `formatElapsed` (duration column) is shared with
  `src/features/typing/TypingRun.tsx`'s live race-clock display — it lives
  in `src/lib/` because both features need it, not because this folder
  owns it.

## Aggregate stats vs. recent runs — two independent empty/loading states

`useProfileStats` (aggregate best/avg/total) and `useRecentRuns` (the
list) are separate hooks with their own loading/error/empty states,
deliberately not combined into one — a player can have aggregate stats
with no visible recent-runs rows yet (or vice versa, while one query is
still loading), and collapsing them into a single state would make one of
those cases unrepresentable.

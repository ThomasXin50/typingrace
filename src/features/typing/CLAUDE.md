# Typing engine

The core keystroke-replay engine shared by solo, practice, and multiplayer
races. The one invariant that matters more than anything else here: this
folder's scoring logic is **not allowed to drift from the server's**.

## The server-mirror invariant

`useTypingEngine.ts`'s internal `replay()` is a line-for-line mirror of
`supabase/functions/_shared/validate.ts`'s `computeStats()` (see
`supabase/CLAUDE.md`) — same continue-through-errors model, same
finish-lock (every keystroke after the text completes, including a
trailing backspace, is ignored), same `effectiveStart ?? firstTimestamp`
elapsed-time rule, same wpm/rawWpm/accuracy formulas (`WORD_LENGTH = 5`).
This is what guarantees the live stats a player sees can never silently
disagree with the server-authoritative result that actually gets stored.
**If you change the replay/scoring math here, make the identical change on
the Edge Function side in the same PR** — never one without the other.

## Timestamp sourcing: solo vs. race

- Solo/practice: keystroke timestamps come from the native event's own
  `timeStamp` (`performance.now()`-relative), and elapsed time is measured
  from this player's own first keystroke (`startTimestamp` omitted).
- A multiplayer race passes `now={() => Date.now()}` and
  `startTimestamp={Date.parse(round.started_at)}` into `TypingRun`
  (see `src/features/multiplayer/CLAUDE.md`) so every participant's
  elapsed time is measured from the same synchronized wall-clock start,
  not their own reaction time — a slow start should count against a
  racer, not quietly reset their clock. `useTypingEngine`'s
  `startTimestamp` option and `replay()`'s `effectiveStart` are what make
  that work; don't thread a new timestamp source through without
  preserving this distinction.

## Two independent chart-math modules — deliberately not shared

`wpmChartMath.ts` (this folder, used by `WpmChart` for a single finished
run's wpm-over-time) and `src/features/profile/runsTrendChartMath.ts`
(used by `RunsTrendChart` for wpm-across-runs) look similar but encode
different semantics and are **intentionally not DRY'd into one module**:

- x-axis: `wpmChartMath.xForTime` plots elapsed seconds within one run;
  `runsTrendChartMath`'s x maps a sequence _index_ across many runs.
- y-axis: `wpmChartMath.yForWpm(wpm, maxWpm)` forces the scale through a
  zero origin (`withOrigin` seeds an explicit `{0, 0}` point) — right for
  "wpm ramping up from a stopped start." `runsTrendChartMath`'s y takes
  both a min _and_ max and scales to the data's actual range — right for
  "did this player's wpm trend up over time," where forcing zero would
  flatten the real variation.

If a future change makes these look like they should merge, that's a sign
the merged version would get one of the two axes wrong, not a missed
DRY opportunity.

## Other non-obvious bits

- `useCountUp` (used for the post-run stat tiles in `TypingRun.tsx`) is
  always called, never behind a conditional — React's rules of hooks —
  and is seeded at `0` until `engine.stats` actually exists, animating up
  to the real value exactly once per finished run.
- `useAutoScrollText` measures rendered span positions to decide which
  line a character lands on; it can't be derived from the character index
  alone since that depends on where the browser actually wraps the text
  at the current width.
- `wpmSeries.ts` buckets by 1-second intervals (`BUCKET_MS`) and needs at
  least 3 buckets (`MIN_DURATION_MS`) of data before it produces a series
  at all — a very short run has no meaningful trend to chart.

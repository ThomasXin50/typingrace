# Typing Test — Design Doc

Portfolio project: React + TypeScript frontend, Supabase backend (Postgres,
Auth, Realtime, Edge Functions), deployed on Vercel. Goal is to demonstrate
real backend/database depth (RLS as an authorization model, server-authoritative
validation, Realtime multiplayer, non-trivial calibration logic), not just CRUD.

## Build order

1. Solo mode: solid schema, auth, submission/validation pipeline, leaderboards.
2. Multiplayer: rooms/rounds, Realtime races, disconnect/stall handling.
3. Ship. Multiplayer is a launch blocker — this isn't going on the portfolio
   until races actually work, since that's the headline feature.

## Auth

- Anonymous sessions (`signInAnonymously`) allowed everywhere — no forced
  sign-up wall before trying the app, including solo runs, leaderboard
  appearance, and hosting/joining multiplayer rooms. All of it is tied to
  that browser's anonymous profile id, which stays stable across runs/races
  for that session. A real account's advantage over anonymous is durability
  (an anonymous session's history is lost if local storage is cleared or the
  account is never upgraded), not a feature gate.
- A real account (upgradeable from anonymous, preserving local history) is
  required for: submitting texts to the shared pool.
- Anywhere a profile is shown publicly — leaderboards, room rosters, race
  results — an anonymous profile's generated username is never displayed
  directly. It reads "Guest" instead, with a short id-derived suffix added
  only when more than one guest appears in the same listing (e.g. several
  anonymous players in one room), so they stay distinguishable without
  exposing the real generated username.
- Providers at launch: email+password, GitHub OAuth, Google OAuth.
- Deferred: Apple OAuth (requires a paid Apple Developer account — revisit
  later if worth the cost).

## Texts

Three tiers, each with a different storage/visibility model:

1. **Curated texts** — seeded by us, stored in Postgres `texts` table.
2. **User-submitted texts** — stored in Postgres, held in a moderation queue
   (`status: pending | approved | rejected`) before entering the shared pool.
   The submitter can practice solo against their own pending submission while
   it awaits review, but it doesn't appear to anyone else, doesn't enter
   leaderboards, and can't be used in a race until approved.
3. **Private custom texts** — client-side only (localStorage/IndexedDB), never
   synced to Postgres. Strictly solo: never usable in a race (every racer
   needs identical, server-known content), never counted in any leaderboard
   (they're simply invisible to the backend).

Admins approve/reject submissions (Postgres function/trigger handles the
status transition and is the only path that can move a text into `approved`).
Difficulty is **not** manually tagged by the admin — see Difficulty
Calibration below.

## Anti-cheat / result validation

Modeled loosely on how TypeRacer defends against bots (checking `isTrusted`
on keystroke events, throttling/challenging implausible speeds) — see
https://mathewsachin.github.io/blog/2026/03/20/hacking-typeracer.html .

- Client records a per-keystroke timestamp log (every keystroke, correct or
  not, plus `event.isTrusted`) during a run.
- On submission, an **Edge Function** receives the log, recomputes
  WPM/accuracy from the raw deltas, and compares against the claimed result.
  Mismatches beyond tolerance, or anomaly heuristics (impossible consistency,
  WPM over a hard ceiling) set `validation_status: flagged` rather than
  silently rejecting — mirrors TypeRacer's "confirm via challenge" pattern.
- The raw keystroke log is **validated and discarded** — never persisted.
  Only the final result row + `validation_status` survive.
- `solo_runs` and `round_participants` have **no client-side insert policy at
  all**. The Edge Function (using the service role key) is the only write
  path for any result, solo or multiplayer. This is the core integrity
  guarantee — not "we double-checked," but "the client cannot write a result
  directly, period."

## Difficulty calibration (Elo-style, one-sided)

Only text difficulty is a true latent variable worth inferring — it can't be
read directly from the content, only observed indirectly through performance,
and that signal is confounded by who's typing. Player skill does **not** get
the same treatment: WPM is already a direct, objective, comparable number, so
giving players an opaque synthetic rating on top of it would just obscure
something already measurable. (This mirrors why chess needs Elo at all: no
objective per-game performance number exists there, only win/loss.)

- `texts.difficulty_rating`: seeded from a content heuristic at submission
  time (avg word length, punctuation/special-character density, number
  density, capitalization switches) so every text has a sane starting value,
  no cold-start problem.
- `texts.difficulty_source`: `heuristic | calibrated` — lets filters/UI
  distinguish "proven" ratings from still-unproven guesses.
- On each validated solo run:
  - `E` = expected performance, a logistic function of
    `(user's rolling-avg WPM vs. text's difficulty_rating)`.
  - `S` = actual performance, a sigmoid-squashed comparison of this run's WPM
    against the WPM that gap would predict.
  - `difficulty_rating += K * (E - S)`, where `K` decays as the text
    accumulates more rated runs (volatile while new/unproven, stable once
    mature).
- The "ability" side of the formula is the user's own directly-observed
  rolling average, not an inferred rating — this is what prevents a
  weak-typist-heavy sample from mislabeling an easy text as harder than it is
  (the original concern that prompted this design).
- Require a minimum number of **distinct users** (not just runs) before a
  text's rating is trusted as `calibrated`; use a trimmed/robust average to
  limit the influence of any single outlier run.
- Difficulty filter buckets (easy/normal/hard/all) are derived from quantiles
  of the current rating distribution, not fixed absolute thresholds, so they
  stay meaningful as the corpus grows.
- Formula constants (the sigmoid scale, initial `K`, minimum distinct-user
  threshold) are reasonable starting estimates — expected to be tuned once
  real usage data exists, not treated as final on day one.

## Multiplayer: rooms and rounds

A **room** is the persistent lobby (host, roster, survives across races); a
**round** is one actual timed race within a room (one text, one start time,
one set of results). This split exists specifically to support "I stopped
typing but I'm still in the room and will auto-join the next race."

- **Lobby model**: private lobbies only at launch — host creates a room, gets
  a shareable code/link, invites people, starts manually. Public matchmaking
  is explicitly deferred.
- **Room settings**: a difficulty filter (easy/normal/hard/all), set once by
  the host. Max 8-10 players per room.
- **Text selection**: fully automatic — each round picks a random
  `approved` text matching the room's difficulty filter. No manual per-round
  picking, no voting.
- **Race start**: host-initiated ("Start Race" whenever ready, no per-player
  ready-check), followed by a synchronized countdown broadcast to all
  participants anchored to a shared timestamp (not each client's local
  clock), so everyone's first keystroke lands at the same instant regardless
  of latency. `rounds.started_at` is the single source of truth for
  elapsed-time/WPM calculation.
- **Live progress**: Realtime **Broadcast** on a per-room channel carries
  ephemeral `{ user_id, progress_pct, wpm_so_far, ts }` packets, sent on every
  keystroke (correct or not — a struggling-but-still-typing player counts as
  active). Never written to Postgres.
- **Room/round lifecycle events** (join, leave, round start, round finish) go
  over Postgres Changes, so late joiners/spectators see current state.

### Liveness: two independent signals, 10s each

- **Stalled** (no keystroke of any kind from a still-connected participant
  for 10s): `round_participants.status = 'stalled'`. Locked out of _this_
  round for good (no resuming, even if they start typing again) — this
  prevents one person from holding the round hostage after giving up.
  Their `room_members` row is untouched: they stay in the room, can spectate
  the rest of this round, and are automatically entered into the next round.
- **Left** (Realtime Presence on the room channel detects the connection is
  actually gone — e.g. tab closed): removed from `room_members` entirely,
  and from the current round's participation. Not auto-queued for anything.
  - Note for review: a brief, non-clean connection drop (flaky wifi) that
    reconnects quickly won't typically have been announced as a Presence
    "leave" yet, since Presence detection of an unclean disconnect lags
    (up to its heartbeat interval) — so quick reconnects are naturally
    tolerated without a separate app-level grace timer, while a deliberate
    tab close is detected immediately and treated as a real departure.
    Flag this if a more explicit reconnect-grace mechanism is wanted instead.
- This app is desktop-browser-first; mobile backgrounding/throttling edge
  cases are an accepted non-goal, not something the design tries to handle.

## Data model (sketch, not final DDL)

```
profiles (id, username, avatar_url, role, created_at)

texts (id, content, language, category, status, difficulty_rating,
       difficulty_source, submitted_by, created_at)

solo_runs (id, user_id, text_id, wpm, raw_wpm, accuracy, consistency,
           duration_ms, error_count, validation_status, created_at)
  -- insert only via Edge Function (service role); no client insert policy

rooms (id, host_id, status, max_players, difficulty_filter, created_at)

room_members (room_id, user_id, status[active|spectating], joined_at)

rounds (id, room_id, text_id, status, started_at, ended_at)

round_participants (round_id, user_id, status[racing|finished|stalled],
                     wpm, accuracy, placement, field_size, created_at)
  -- insert/update only via Edge Function; placement/field_size computed
  -- from finishers only (stalled participants get placement = null and
  -- don't count toward field_size)
```

## Leaderboards & stats

- **Solo leaderboards**: views over `solo_runs`, filtered to
  `texts.status = 'approved'` only — pending submissions can't be farmed for
  leaderboard credit, and private local texts are automatically excluded
  (they never reach Postgres at all).
- **Race stats**: tracked entirely separately from solo stats, no merged
  "skill rating." Two counters only, both derived from directly observable
  results (no Elo for players):
  - `races_won` — count of strict #1 finishes.
  - `races_top_half` — count of finishes within the top `floor(field_size/2)`
    among that round's finishers.
  - Both computed from finishers only; a `stalled` participant earns neither
    stat and doesn't count toward `field_size` for others' calculations.

## Hosting & ops

- Target Supabase/Vercel free tier by default; don't distort the design to
  fit it artificially — upgrade later if actually needed.
- Room cleanup: delete a room as soon as it has no active members. Primary
  path is the last-leaving client calling a cleanup RPC on unload; backed by
  a periodic sweep (every 30-60s, via `pg_cron` or a scheduled Edge Function)
  that deletes any room with zero Presence as the reliable fallback, since a
  client-side-only trigger isn't guaranteed to fire.

## Explicitly deferred / out of scope for launch

- Public matchmaking queue (private lobby-only for v1).
- Apple OAuth (cost-gated on Apple Developer Program membership).
- Any Elo/rating ladder for player-vs-player race skill (deliberately
  rejected — race results are already directly observable, no inference
  needed).
- Retaining raw keystroke logs post-validation (privacy/storage cost with no
  planned use).

# Multiplayer

Private-room, multi-round live races. The most stateful feature in the
app — most of what's non-obvious here is about keeping independent
players' views of the same room/round consistent without a shared client
store (there is no Redux/Context for this; everything is Supabase
Realtime + small focused hooks).

## Room lifecycle

- A room has `status: 'lobby' | 'racing'` (`types.ts`). `RoomPage` renders
  the lobby UI; the instant `status` flips to `'racing'` it swaps to
  `RacePage` and _stays_ on `RacePage` until that page itself calls
  `onDone` — not the instant `status` flips back to `'lobby'`, which
  happens as soon as everyone else finishes too, often well before a
  given player has had a moment to look at their own results.
- **`currentRoom.ts`** (plain functions over `localStorage`, deliberately
  _not_ a hook/Context) is "which room am I in," persisted outside any
  single page's lifecycle so it survives SPA navigation away and back, or
  a reload. `RoomPage` is its sole writer: sets it once the room has
  genuinely loaded, clears it once the room is confirmed gone
  (`!loading && !error && !room`) or on an explicit leave. `MultiplayerPage`
  reads it on mount to redirect straight back into an existing room instead
  of showing the create/join form.
- **`App.tsx`** calls the heartbeat/unload-leave hooks
  (`useRoomHeartbeat`, `useLeaveOnUnload`) once, unconditionally, for the
  app's whole lifetime — not scoped to `RoomPage`'s mount. Each reads
  `getCurrentRoomId()` fresh on every tick / on `pagehide` itself, so
  heartbeating survives _any_ in-app navigation away from the room, not
  just a round trip through `/multiplayer`. A room that got cleaned up
  while a player was away (swept, or the host deleted it) self-heals the
  next time they visit `/multiplayer` — one harmless bounce into a "room
  not found" state at worst, not a permanent loop.
- Host-leave confirmation (`RoomPage`'s `confirmingLeave` state) only
  shows for `isHost && members.length > 1` — leaving an empty room or
  leaving as a non-host needs no warning. If everyone else leaves (or gets
  swept) while the confirmation is open, it dismisses itself on the next
  render rather than leave stale "leaving will transfer host…" text
  showing when leaving now would actually just delete the room.

## Round lifecycle (`RacePage.tsx`)

- `useActiveRound` only ever matches a room's currently `'active'` round —
  that match stops the instant the round closes (everyone's finished).
  `RacePage` freezes the last known non-null `round`/`content` in local
  state specifically so a player's own results stay visible through that
  transition instead of reverting to "Waiting for the race to start…"
  immediately after finishing.
- `roundClosed` means _the round itself_ closed (the shared signal: the
  active-round query stopped matching), not "this player personally
  finished" — other players may still be racing when it flips. Everyone
  observes this transition from the same source, which is what keeps the
  post-race "back to lobby in Ns" countdown synchronized across
  participants instead of each starting it independently whenever they
  happen to finish typing.
- `PENDING_ROUND_PLACEHOLDER` (a far-future static ISO string) exists only
  to seed `useCountdown` before a real round has loaded — it's never
  displayed. It has to be a static literal, not something like
  `Date.now() + margin`, because `useCountdown`'s initial state is seeded
  once from whatever it's first called with and render must stay pure.
- The stall watcher (`useStallWatcher`) is armed the instant the race
  actually starts (not waiting for a first keystroke that may never
  come) and disarms once this player has genuinely finished or the round
  has already closed. A stalled player keeps spectating the rest of the
  round rather than being removed from it.
- Race timestamps are wall-clock (`now={() => Date.now()}`,
  `startTimestamp={Date.parse(round.started_at)}` passed into
  `TypingRun`), unlike solo/practice's default `performance.now()`-relative
  timestamps — this is what makes a player's elapsed time comparable
  across participants, and what the server-side validation in
  `supabase/functions/_shared/validate.ts` mirrors on the anti-cheat side
  (see `supabase/CLAUDE.md`).

## Testing this folder

Same Vitest/RTL stack as the rest of the frontend (see root `CLAUDE.md`) —
nothing Deno/pgTAP-specific lives here even though it talks to Edge
Functions; the Edge Function side of a flow (e.g. `start-race`,
`submit-round-run`) is tested in `supabase/functions/`, not re-tested from
this folder.

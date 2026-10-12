# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two groups, same product:

- **Solo typists** practicing speed/accuracy, with no account required to try it.
- **Small groups of friends** racing each other live in a private room via a
  shared link — not strangers matched through public queuing.

(A secondary, non-designed-for audience: portfolio reviewers evaluating the
builder's engineering skill. They interact with the product exactly as an
end user would; the product itself never performs "this is a portfolio
piece" beyond a small footer credit — see Brand Commitments.)

## Product Purpose

A typing speed test and practice tool where every competitive result is
validated, not just trusted: solo runs and race results are recomputed
server-side from a raw keystroke log before being accepted. Text difficulty
is continuously calibrated from real typing performance rather than hand-
tagged. Multiplayer is live, synchronized private-room races against friends.

## Positioning

Unlike typical typing-test clones that trust client-reported WPM outright,
every result here is recomputed server-side before it counts — the client
cannot write a result directly. Text difficulty is estimated via an
Elo/Rasch-style calibration from real performance data, not manually tagged.
Multiplayer rooms are persistent (many rounds per room) rather than one-off
matches, and are private-by-default, not publicly matchmade.

## Operating Context

Desktop browser, single session, no install. A visitor can start typing
immediately with no account (anonymous session). An account (email, GitHub,
or Google) is required only once they want saved history, a leaderboard
appearance, to submit a text, or to host/join a multiplayer room. Races are
played with a small known group via a shared private link.

## Capabilities and Constraints

- Anonymous access for solo practice; account required for history,
  leaderboard, text submission, and multiplayer.
- Private lobbies only at launch (no public matchmaking); rooms capped at
  8-10 players.
- Desktop-browser-first; mobile backgrounding/throttling edge cases are an
  explicit non-goal, not a bug.
- Backend: Supabase (Postgres, Auth, Realtime, Edge Functions); frontend on
  Vercel; targets the free tier by default without distorting the design to
  fit it.
- Text content: curated + moderated user submissions live in Postgres;
  private custom texts stay client-side only and are solo-only (never
  usable in a race, never on any leaderboard).

## Brand Commitments

Name: **Typing Race** (confirmed; matches the existing repo/app title).

Volunteered, binding constraint for later visual-world decisions: a
utilitarian, minimalist aesthetic with clean/precise data representations —
Monkeytype's site was named as the touchstone. Recorded here as a constraint
only; palette/type/component decisions belong to the visual-design phase,
not this document.

## Evidence on Hand

No existing testimonials, press, or case studies — this is a greenfield
product with no prior users yet. No existing logo or visual assets.
`DESIGN.md` documents the full agreed technical architecture (text tiers and
moderation, anti-cheat validation path, Elo-style difficulty calibration,
room/round multiplayer model, RLS authorization model) and is durable
product/technical truth this file does not duplicate.

## Product Principles

1. Trust nothing the client reports — every competitive result, solo or
   race, is recomputed and validated server-side before it counts.
2. Clarity and speed of information over decoration — the interface gets out
   of the way of typing and of reading your own data quickly.
3. Private-by-default multiplayer — races happen among people who already
   know each other via a shared link, never strangers matched publicly.
4. Numbers earn their place through real usage — difficulty and skill
   signals come from observed performance, never manual tagging or invented
   ratings.
5. The product demonstrates engineering depth through how it behaves, not
   by telling the user it's a portfolio piece.

## Accessibility & Inclusion

No specific standard confirmed yet. Noted as inferred rather than confirmed:
since the entire product is keyboard-driven by nature, keyboard-only
operation, visible focus states, and sufficient color contrast matter more
here than in a typical app — worth treating as a baseline requirement rather
than an afterthought when the visual design is built.

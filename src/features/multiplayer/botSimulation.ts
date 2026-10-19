import type { BotPersonality } from './botPersonalities'

const WORD_LENGTH = 5

// FNV-1a string hash, feeding a mulberry32 PRNG - cheap, deterministic, and
// good enough distribution for timing/error jitter (not cryptographic).
// Every connected client simulates a bot independently and must land on
// the identical result, so the seed (round id + bot id) is the only thing
// that may vary the output - see src/features/multiplayer/CLAUDE.md.
function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1
  return function mulberry32() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type CharClass = 'specialty' | 'normal'

interface PersonalityDef {
  classify: (char: string) => CharClass
  speedFactor: Record<CharClass, number>
  errorRate: Record<CharClass, number>
}

// Lowercase letters and spaces - the one character set every personality
// treats as its universal "easy" baseline (see the Typeracer definition's
// own comment for why this classifier is reused rather than personality-
// specific for that one).
const EASY_CHARS = /[a-z ]/

const PERSONALITIES: Record<BotPersonality, PersonalityDef> = {
  // Fast and accurate on brackets/underscores/numbers/symbols, slower and
  // more error-prone on plain prose.
  coder: {
    classify: (char) =>
      /[{}()[\]<>_0-9+\-*/=;:!@#$%^&*]/.test(char) ? 'specialty' : 'normal',
    speedFactor: { specialty: 0.75, normal: 1.15 },
    errorRate: { specialty: 0.01, normal: 0.05 },
  },
  // Strong, even pace on normal English text; only a mild slowdown outside
  // it - well-rounded rather than dramatically specialized.
  typist: {
    classify: (char) =>
      /[a-zA-Z ,.'!?"-]/.test(char) ? 'specialty' : 'normal',
    speedFactor: { specialty: 0.95, normal: 1.1 },
    errorRate: { specialty: 0.02, normal: 0.08 },
  },
  // Fast on bare lowercase letters and spaces; struggles with punctuation,
  // digits, and capitalization (shift key included).
  monkeytyper: {
    classify: (char) => (EASY_CHARS.test(char) ? 'specialty' : 'normal'),
    speedFactor: { specialty: 0.7, normal: 1.4 },
    errorRate: { specialty: 0.02, normal: 0.12 },
  },
  // Zero mistakes, ever - errorRate is 0 in both classes, never flagged.
  // "Paces itself to never make a mistake" becomes a timing trait once
  // error-proneness is taken off the table: it still slows down
  // noticeably on the characters every other personality finds tricky,
  // it just never gets them wrong.
  typeracer: {
    classify: (char) => (EASY_CHARS.test(char) ? 'specialty' : 'normal'),
    speedFactor: { specialty: 0.9, normal: 1.6 },
    errorRate: { specialty: 0, normal: 0 },
  },
}

export interface SimulatedKeystroke {
  charIndex: number
  atMs: number
  correct: boolean
}

export interface BotRunResult {
  keystrokes: SimulatedKeystroke[]
  finishMs: number
  wpm: number
  rawWpm: number
  accuracy: number
  errorCount: number
}

/**
 * Simulates a bot typing `text` start to finish - deterministic given the
 * same (text, personality, seed, baseWpm), so every client computes the
 * identical result independently (see src/features/multiplayer/CLAUDE.md
 * for why no single "driver" client or server process is needed). Scores
 * the same continue-through-errors way useTypingEngine/validate.ts do: a
 * mistyped character still advances and counts as an error, never blocks
 * completion.
 */
export function simulateBotRun(
  text: string,
  personality: BotPersonality,
  seed: string,
  baseWpm: number,
): BotRunResult {
  const random = createSeededRandom(seed)
  const def = PERSONALITIES[personality]
  const msPerCharBase = 60_000 / baseWpm / WORD_LENGTH

  const keystrokes: SimulatedKeystroke[] = []
  let atMs = 0
  let correctCount = 0

  for (let i = 0; i < text.length; i++) {
    const charClass = def.classify(text[i])
    // +/-20% jitter so a run doesn't look metronome-regular.
    const jitter = 0.8 + random() * 0.4
    atMs += msPerCharBase * def.speedFactor[charClass] * jitter

    const correct = random() >= def.errorRate[charClass]
    if (correct) correctCount++
    keystrokes.push({ charIndex: i, atMs, correct })
  }

  const finishMs = atMs
  const minutes = finishMs / 60_000
  const errorCount = text.length - correctCount

  return {
    keystrokes,
    finishMs,
    wpm: minutes > 0 ? correctCount / WORD_LENGTH / minutes : 0,
    rawWpm: minutes > 0 ? text.length / WORD_LENGTH / minutes : 0,
    accuracy: text.length > 0 ? (correctCount / text.length) * 100 : 100,
    errorCount,
  }
}

const MIN_CALIBRATED_WPM = 20

/**
 * Pulls a bot's base wpm halfway toward the human players' recent average,
 * so a race against strong typists is a genuinely harder race than one
 * against beginners - same spirit as this app's existing Elo/Rasch text-
 * difficulty calibration (see DESIGN.md). `playersAvgWpm` is null when no
 * reliable average exists yet (e.g. brand new accounts with no history),
 * in which case the personality's own baseline is used unchanged.
 */
export function calibrateBaseWpm(
  personalityBaseWpm: number,
  playersAvgWpm: number | null,
): number {
  if (playersAvgWpm === null || playersAvgWpm <= 0) return personalityBaseWpm

  const BLEND = 0.5
  const blended = personalityBaseWpm * (1 - BLEND) + playersAvgWpm * BLEND
  return Math.max(MIN_CALIBRATED_WPM, blended)
}

const RUBBER_BAND_GAIN = 0.4
const MIN_PACE_MULTIPLIER = 0.6
const MAX_PACE_MULTIPLIER = 1.5

/**
 * Nudges a bot's pace multiplier toward the live human pack's progress -
 * fallen behind, speed up a little; too far ahead, ease off. Clamped so
 * rubber-banding can bend a personality's pace but never erase its
 * identity (a Coder on prose never gets rubber-banded into Typist-level
 * speed). Called once per tick with the previous multiplier, not
 * recomputed from scratch, so the adjustment is gradual rather than a
 * snap to the human's exact position.
 */
export function rubberBandPaceMultiplier(
  humanProgress: number,
  botProgress: number,
  previousMultiplier: number,
): number {
  const next =
    previousMultiplier + RUBBER_BAND_GAIN * (humanProgress - botProgress)
  return Math.min(MAX_PACE_MULTIPLIER, Math.max(MIN_PACE_MULTIPLIER, next))
}

/** How far through its run a bot has progressed (0-1) at a given elapsed
 * time - the bot-side analog of a human's live broadcast progress, read
 * the same way by the race UI. */
export function botProgressAtTime(
  run: BotRunResult,
  elapsedMs: number,
): number {
  if (run.keystrokes.length === 0) return 0
  if (elapsedMs >= run.finishMs) return 1

  let typed = 0
  for (const keystroke of run.keystrokes) {
    if (keystroke.atMs > elapsedMs) break
    typed = keystroke.charIndex + 1
  }
  return typed / run.keystrokes.length
}

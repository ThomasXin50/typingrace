import { describe, expect, it } from 'vitest'
import {
  botProgressAtTime,
  createSeededRandom,
  simulateBotRun,
} from './botSimulation'

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom('round-1:bot-1')
    const b = createSeededRandom('round-1:bot-1')
    const sequenceA = Array.from({ length: 10 }, () => a())
    const sequenceB = Array.from({ length: 10 }, () => b())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces a different sequence for a different seed', () => {
    const a = createSeededRandom('round-1:bot-1')
    const b = createSeededRandom('round-1:bot-2')
    expect(a()).not.toBe(b())
  })

  it('always produces values in [0, 1)', () => {
    const random = createSeededRandom('any-seed')
    for (let i = 0; i < 200; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('simulateBotRun', () => {
  const PROSE = 'The quick brown fox jumps over the lazy dog.'
  // Deliberately symbol/digit-only (no letters, no commas) so it isolates
  // Coder's specialty set from Typist's prose-leaning one, which otherwise
  // overlaps on letters/spaces/commas/periods.
  const CODE = '{0:1}[0]+={1:2}[1]*2/4-1;'
  const MIXED = 'a1b2c3d4e5f6g7h8'

  it('is fully deterministic for the same inputs', () => {
    const a = simulateBotRun(PROSE, 'coder', 'round-1:bot-1', 70)
    const b = simulateBotRun(PROSE, 'coder', 'round-1:bot-1', 70)
    expect(a).toEqual(b)
  })

  it('differs when the seed differs', () => {
    const a = simulateBotRun(PROSE, 'coder', 'round-1:bot-1', 70)
    const b = simulateBotRun(PROSE, 'coder', 'round-1:bot-2', 70)
    expect(a.finishMs).not.toBe(b.finishMs)
  })

  it('produces one keystroke per character, in order, ending at finishMs', () => {
    const run = simulateBotRun(PROSE, 'typist', 'seed', 70)
    expect(run.keystrokes).toHaveLength(PROSE.length)
    expect(run.keystrokes.map((k) => k.charIndex)).toEqual(
      PROSE.split('').map((_, i) => i),
    )
    expect(run.keystrokes[run.keystrokes.length - 1].atMs).toBe(run.finishMs)
    for (let i = 1; i < run.keystrokes.length; i++) {
      expect(run.keystrokes[i].atMs).toBeGreaterThan(run.keystrokes[i - 1].atMs)
    }
  })

  it('computes wpm/accuracy/errorCount consistently from the keystroke log', () => {
    const run = simulateBotRun(PROSE, 'monkeytyper', 'seed', 60)
    const correctCount = run.keystrokes.filter((k) => k.correct).length
    expect(run.errorCount).toBe(PROSE.length - correctCount)
    expect(run.accuracy).toBeCloseTo((correctCount / PROSE.length) * 100, 5)
    expect(run.rawWpm).toBeGreaterThan(run.wpm)
  })

  it('the Coder is faster on a code-like text than the Typist is', () => {
    const coder = simulateBotRun(CODE, 'coder', 'seed', 70)
    const typist = simulateBotRun(CODE, 'typist', 'seed', 70)
    expect(coder.finishMs).toBeLessThan(typist.finishMs)
  })

  it('the Typist is faster on plain prose than the Coder is', () => {
    const coder = simulateBotRun(PROSE, 'coder', 'seed', 70)
    const typist = simulateBotRun(PROSE, 'typist', 'seed', 70)
    expect(typist.finishMs).toBeLessThan(coder.finishMs)
  })

  it('the Monkeytyper is faster on lowercase-and-spaces text than on punctuation-heavy text', () => {
    const lettersOnly = simulateBotRun(
      'the quick brown fox jumps over the lazy dog',
      'monkeytyper',
      'seed',
      65,
    )
    const punctuationHeavy = simulateBotRun(CODE, 'monkeytyper', 'seed', 65)
    // Compare per-character pace, not raw finishMs, since the texts differ in length.
    expect(lettersOnly.finishMs / lettersOnly.keystrokes.length).toBeLessThan(
      punctuationHeavy.finishMs / punctuationHeavy.keystrokes.length,
    )
  })

  it('the Typeracer never makes a mistake, even on a symbol/digit-heavy text', () => {
    const run = simulateBotRun(CODE, 'typeracer', 'seed', 70)
    expect(run.errorCount).toBe(0)
    expect(run.accuracy).toBe(100)
  })

  it('the Typeracer still paces more slowly through hard characters than easy ones', () => {
    const run = simulateBotRun(MIXED, 'typeracer', 'seed', 70)
    const delays = run.keystrokes.map((k, i) =>
      i === 0 ? k.atMs : k.atMs - run.keystrokes[i - 1].atMs,
    )
    const hardCharDelays = delays.filter((_, i) => !/[a-z ]/.test(MIXED[i]))
    const easyCharDelays = delays.filter((_, i) => /[a-z ]/.test(MIXED[i]))
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(avg(hardCharDelays)).toBeGreaterThan(avg(easyCharDelays))
  })
})

describe('botProgressAtTime', () => {
  const run = simulateBotRun('hello world', 'typist', 'seed', 70)

  it('is 0 before the first keystroke', () => {
    expect(botProgressAtTime(run, 0)).toBe(0)
  })

  it('is 1 at and after finishMs', () => {
    expect(botProgressAtTime(run, run.finishMs)).toBe(1)
    expect(botProgressAtTime(run, run.finishMs + 1000)).toBe(1)
  })

  it('matches the fraction typed at an exact keystroke timestamp', () => {
    const midKeystroke = run.keystrokes[4]
    expect(botProgressAtTime(run, midKeystroke.atMs)).toBeCloseTo(5 / 11, 5)
  })

  it('is monotonically non-decreasing over time', () => {
    let previous = 0
    for (let t = 0; t <= run.finishMs; t += 50) {
      const progress = botProgressAtTime(run, t)
      expect(progress).toBeGreaterThanOrEqual(previous)
      previous = progress
    }
  })
})

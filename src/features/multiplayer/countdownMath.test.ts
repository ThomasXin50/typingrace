import { describe, expect, it } from 'vitest'
import { msRemaining } from './countdownMath'

describe('msRemaining', () => {
  it('returns positive ms when the start is still in the future', () => {
    expect(
      msRemaining(
        '2026-01-01T00:00:05.000Z',
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(5000)
  })

  it('clamps to zero once the start time has passed, never negative', () => {
    expect(
      msRemaining(
        '2026-01-01T00:00:00.000Z',
        Date.parse('2026-01-01T00:00:05.000Z'),
      ),
    ).toBe(0)
  })

  it('is zero exactly at the start instant', () => {
    expect(
      msRemaining(
        '2026-01-01T00:00:00.000Z',
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { formatElapsed } from './formatElapsed'

describe('formatElapsed', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatElapsed(75_000)).toBe('1:15')
    expect(formatElapsed(5_000)).toBe('0:05')
    expect(formatElapsed(0)).toBe('0:00')
  })

  it('floors partial seconds rather than rounding', () => {
    expect(formatElapsed(1_999)).toBe('0:01')
  })

  it('clamps a negative duration to 0:00', () => {
    expect(formatElapsed(-500)).toBe('0:00')
  })

  it('rolls over past 59 seconds into the next minute', () => {
    expect(formatElapsed(119_000)).toBe('1:59')
    expect(formatElapsed(120_000)).toBe('2:00')
  })
})

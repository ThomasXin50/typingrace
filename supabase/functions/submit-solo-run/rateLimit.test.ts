import { assertEquals } from 'jsr:@std/assert@1'
import { isWithinCooldown, SUBMISSION_COOLDOWN_MS } from './rateLimit.ts'

Deno.test(
  'isWithinCooldown - no prior submission is never rate-limited',
  () => {
    assertEquals(isWithinCooldown(1_000_000, null), false)
  },
)

Deno.test(
  'isWithinCooldown - a submission inside the cooldown window is blocked',
  () => {
    const now = 1_000_000
    const last = now - (SUBMISSION_COOLDOWN_MS - 1)

    assertEquals(isWithinCooldown(now, last), true)
  },
)

Deno.test(
  'isWithinCooldown - a submission exactly at the cooldown boundary is allowed',
  () => {
    const now = 1_000_000
    const last = now - SUBMISSION_COOLDOWN_MS

    assertEquals(isWithinCooldown(now, last), false)
  },
)

Deno.test(
  'isWithinCooldown - a submission well past the cooldown is allowed',
  () => {
    const now = 1_000_000
    const last = now - SUBMISSION_COOLDOWN_MS * 10

    assertEquals(isWithinCooldown(now, last), false)
  },
)

import { assertEquals } from 'jsr:@std/assert@1'
import {
  BOT_PERSONALITIES,
  isBotPersonality,
  resolvePersonality,
} from './botPersonalities.ts'

Deno.test('isBotPersonality - accepts every known personality', () => {
  for (const personality of BOT_PERSONALITIES) {
    assertEquals(isBotPersonality(personality), true)
  }
})

Deno.test('isBotPersonality - rejects an unknown string', () => {
  assertEquals(isBotPersonality('grandmaster'), false)
})

Deno.test(
  'resolvePersonality - returns a valid requested personality as-is',
  () => {
    assertEquals(resolvePersonality('coder'), 'coder')
  },
)

Deno.test(
  'resolvePersonality - rejects an unknown requested personality',
  () => {
    assertEquals(resolvePersonality('grandmaster'), null)
  },
)

Deno.test(
  'resolvePersonality - picks randomly when undefined, via the injected source',
  () => {
    const alwaysZero = () => 0
    assertEquals(
      resolvePersonality(undefined, alwaysZero),
      BOT_PERSONALITIES[0],
    )
  },
)

Deno.test(
  'resolvePersonality - picks randomly when explicitly "random", via the injected source',
  () => {
    const almostOne = () => 0.999
    assertEquals(
      resolvePersonality('random', almostOne),
      BOT_PERSONALITIES[BOT_PERSONALITIES.length - 1],
    )
  },
)

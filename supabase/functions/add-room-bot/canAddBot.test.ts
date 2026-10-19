import { assertEquals } from 'jsr:@std/assert@1'
import { canAddBot, MAX_BOTS_PER_ROOM } from './canAddBot.ts'

const base = {
  requesterId: 'host-1',
  hostId: 'host-1',
  memberCount: 2,
  botCount: 1,
  maxPlayers: 8,
}

Deno.test('canAddBot - allows the host when under every limit', () => {
  assertEquals(canAddBot(base), { allowed: true })
})

Deno.test('canAddBot - rejects a non-host requester', () => {
  assertEquals(canAddBot({ ...base, requesterId: 'someone-else' }), {
    allowed: false,
    reason: 'only the host can add bots',
  })
})

Deno.test('canAddBot - rejects once the room already has the bot cap', () => {
  assertEquals(canAddBot({ ...base, botCount: MAX_BOTS_PER_ROOM }), {
    allowed: false,
    reason: `a room can have at most ${MAX_BOTS_PER_ROOM} bots`,
  })
})

Deno.test(
  'canAddBot - rejects once members + bots would reach room capacity',
  () => {
    assertEquals(
      canAddBot({ ...base, memberCount: 7, botCount: 1, maxPlayers: 8 }),
      { allowed: false, reason: 'room is full' },
    )
  },
)

Deno.test(
  'canAddBot - allows filling the very last seat exactly at capacity',
  () => {
    assertEquals(
      canAddBot({ ...base, memberCount: 6, botCount: 1, maxPlayers: 8 }),
      { allowed: true },
    )
  },
)

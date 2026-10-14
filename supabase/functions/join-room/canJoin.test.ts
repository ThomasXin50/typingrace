import { assertEquals } from 'jsr:@std/assert@1'
import { canJoin } from './canJoin.ts'

Deno.test('canJoin - allows joining a room with free capacity', () => {
  assertEquals(
    canJoin({ memberCount: 3, maxPlayers: 8, alreadyMember: false }),
    { allowed: true },
  )
})

Deno.test(
  'canJoin - re-joining a room the user is already a member of is allowed (idempotent)',
  () => {
    assertEquals(
      canJoin({ memberCount: 8, maxPlayers: 8, alreadyMember: true }),
      { allowed: true },
    )
  },
)

Deno.test('canJoin - rejects a full room for a new member', () => {
  assertEquals(
    canJoin({ memberCount: 8, maxPlayers: 8, alreadyMember: false }),
    { allowed: false, reason: 'room is full' },
  )
})

Deno.test(
  'canJoin - a room one below capacity still allows the last seat',
  () => {
    assertEquals(
      canJoin({ memberCount: 7, maxPlayers: 8, alreadyMember: false }),
      { allowed: true },
    )
  },
)

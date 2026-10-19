import { assertEquals } from 'jsr:@std/assert@1'
import { planLeave } from './leaveRoom.ts'

const members = (...rows: { userId: string; joinedAt: string }[]) => rows

Deno.test(
  'planLeave - a non-host leaving a multi-member room just removes them',
  () => {
    const remaining = members(
      { userId: 'host', joinedAt: '2026-01-01T00:00:00Z' },
      { userId: 'other', joinedAt: '2026-01-01T00:01:00Z' },
    )

    assertEquals(
      planLeave({ hostId: 'host', leavingUserId: 'other', remaining }),
      {
        deleteRoom: false,
        newHostId: null,
      },
    )
  },
)

Deno.test('planLeave - the last member leaving deletes the room', () => {
  assertEquals(
    planLeave({ hostId: 'host', leavingUserId: 'host', remaining: [] }),
    { deleteRoom: true, newHostId: null },
  )
})

Deno.test(
  'planLeave - the host leaving a room with others transfers host to the earliest-joined remaining member',
  () => {
    const remaining = members(
      { userId: 'late', joinedAt: '2026-01-01T00:05:00Z' },
      { userId: 'early', joinedAt: '2026-01-01T00:02:00Z' },
    )

    assertEquals(
      planLeave({ hostId: 'host', leavingUserId: 'host', remaining }),
      { deleteRoom: false, newHostId: 'early' },
    )
  },
)

Deno.test(
  'planLeave - a non-host leaving never transfers the host, even if they joined earliest',
  () => {
    const remaining = members({
      userId: 'host',
      joinedAt: '2026-01-01T00:05:00Z',
    })

    assertEquals(
      planLeave({ hostId: 'host', leavingUserId: 'other', remaining }),
      { deleteRoom: false, newHostId: null },
    )
  },
)

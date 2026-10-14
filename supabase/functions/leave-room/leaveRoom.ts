interface Member {
  userId: string
  joinedAt: string
}

interface PlanLeaveInput {
  hostId: string
  leavingUserId: string
  remaining: Member[]
}

interface PlanLeaveResult {
  deleteRoom: boolean
  newHostId: string | null
}

export function planLeave(input: PlanLeaveInput): PlanLeaveResult {
  if (input.remaining.length === 0) {
    return { deleteRoom: true, newHostId: null }
  }

  if (input.leavingUserId !== input.hostId) {
    return { deleteRoom: false, newHostId: null }
  }

  const earliest = [...input.remaining].sort((a, b) =>
    a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0,
  )[0]

  return { deleteRoom: false, newHostId: earliest.userId }
}

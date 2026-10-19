interface CanJoinInput {
  memberCount: number
  maxPlayers: number
  alreadyMember: boolean
}

type CanJoinResult = { allowed: true } | { allowed: false; reason: string }

export function canJoin(input: CanJoinInput): CanJoinResult {
  if (input.alreadyMember) return { allowed: true }
  if (input.memberCount >= input.maxPlayers) {
    return { allowed: false, reason: 'room is full' }
  }
  return { allowed: true }
}

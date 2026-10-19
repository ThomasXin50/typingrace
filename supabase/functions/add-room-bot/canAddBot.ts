export const MAX_BOTS_PER_ROOM = 3

interface CanAddBotInput {
  requesterId: string
  hostId: string
  memberCount: number
  botCount: number
  maxPlayers: number
}

type CanAddBotResult = { allowed: true } | { allowed: false; reason: string }

export function canAddBot(input: CanAddBotInput): CanAddBotResult {
  if (input.requesterId !== input.hostId) {
    return { allowed: false, reason: 'only the host can add bots' }
  }
  if (input.botCount >= MAX_BOTS_PER_ROOM) {
    return {
      allowed: false,
      reason: `a room can have at most ${MAX_BOTS_PER_ROOM} bots`,
    }
  }
  if (input.memberCount + input.botCount >= input.maxPlayers) {
    return { allowed: false, reason: 'room is full' }
  }
  return { allowed: true }
}

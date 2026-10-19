export interface RoomSummary {
  id: string
  joinCode: string
  maxPlayers: number
  difficultyFilter: 'easy' | 'normal' | 'hard' | 'all'
  status: 'lobby' | 'racing'
  hostId: string
}

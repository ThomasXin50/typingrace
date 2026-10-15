// Persists "which room am I in" outside any single page's lifecycle, so
// it survives SPA navigation away from /multiplayer/:roomId and back (or
// a reload) - not React state, since nothing here needs to be reactively
// synced across independent hook instances (that would mean introducing
// this codebase's first Context just to keep two call sites in sync).
// Each consumer either checks this once on mount or reads it fresh at the
// moment it's actually needed (a heartbeat tick, a pagehide event), both
// of which are correct without any synchronization at all.
const STORAGE_KEY = 'typingrace.currentRoomId'

export function getCurrentRoomId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing / storage disabled: behaves as if no room is
    // remembered, same as a first-time visit.
    return null
  }
}

export function setCurrentRoomId(roomId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, roomId)
  } catch {
    // Private browsing / storage disabled: the session still works, it
    // just won't survive navigating away and back, or a reload.
  }
}

export function clearCurrentRoomId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ditto
  }
}

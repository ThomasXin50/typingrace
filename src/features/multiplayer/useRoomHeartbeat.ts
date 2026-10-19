import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentRoomId } from './currentRoom'

const HEARTBEAT_INTERVAL_MS = 5000

// The reliable fallback half of "left" detection - last_seen_at is bumped
// here every 5s for whichever room currentRoom says the player is
// currently in; a pg_cron sweep elsewhere removes anyone who goes quiet
// past a few missed beats. Mounted once at the app level (not scoped to
// RoomPage) and reads the current room fresh on every tick, so it keeps
// beating across any in-app navigation away from the room page, not just
// while that specific page happens to be mounted. Nothing to read back -
// the server doesn't report anything useful for a plain heartbeat, so
// this fires and forgets.
export function useRoomHeartbeat(): void {
  useEffect(() => {
    function beat() {
      const roomId = getCurrentRoomId()
      if (!roomId) return

      supabase.functions.invoke('heartbeat-room-member', {
        body: { roomId },
      })
    }

    beat()
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])
}

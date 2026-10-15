import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const HEARTBEAT_INTERVAL_MS = 5000

// The reliable fallback half of "left" detection - last_seen_at is bumped
// here every 5s while this player has the room open; a pg_cron sweep
// elsewhere removes anyone who goes quiet past a few missed beats. Nothing
// to read back - the server doesn't report anything useful for a plain
// heartbeat, so this fires and forgets.
export function useRoomHeartbeat(roomId: string | null): void {
  useEffect(() => {
    if (!roomId) return

    function beat() {
      supabase.functions.invoke('heartbeat-room-member', {
        body: { roomId },
      })
    }

    beat()
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [roomId])
}

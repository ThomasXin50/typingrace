import { useEffect } from 'react'
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import { getCurrentRoomId } from './currentRoom'

// The fast path for "left" detection: a clean tab close/navigation-away
// fires pagehide (more reliable than beforeunload for an actual close
// across modern browsers), and this calls the same leave-room function
// the explicit "Leave room" button already uses - just automatically
// instead of only on click. Mounted once at the app level and reads
// whichever room currentRoom says is active at the moment pagehide
// actually fires, rather than being scoped to RoomPage's own mount.
// Built as a raw fetch rather than supabase.functions.invoke so keepalive
// can be set: the browser needs that to actually finish sending the
// request once the page starts unloading. navigator.sendBeacon can't be
// used instead - it doesn't support the Authorization header this
// endpoint requires. This is only the fast path; useRoomHeartbeat's
// pg_cron sweep is the guaranteed fallback for anything that doesn't fire
// pagehide at all (a crash, a force-quit, a network drop).
export function useLeaveOnUnload(): void {
  useEffect(() => {
    function handlePagehide() {
      const roomId = getCurrentRoomId()
      if (!roomId) return

      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (!token) return

        fetch(`${supabaseUrl}/functions/v1/leave-room`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomId }),
          keepalive: true,
        })
      })
    }

    window.addEventListener('pagehide', handlePagehide)
    return () => window.removeEventListener('pagehide', handlePagehide)
  }, [])
}

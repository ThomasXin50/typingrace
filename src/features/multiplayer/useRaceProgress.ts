import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseRaceProgressResult {
  /** Latest known progress fraction (0-1) per user id, from every other
   * participant's broadcasts (and this client's own, once sent). */
  progress: Record<string, number>
  sendProgress: (progressPct: number) => void
}

interface ProgressPayload {
  userId: string
  progressPct: number
}

// Ephemeral, never written to Postgres - a public (unauthenticated) channel
// keyed by the round's id, which is the only thing needed to join it. No
// integrity stakes: the real result stays fully server-validated via
// submit-round-run regardless of what a client broadcasts here.
export function useRaceProgress(
  roundId: string | null,
  userId: string | null,
): UseRaceProgressResult {
  const [progress, setProgress] = useState<Record<string, number>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!roundId || !userId) return

    // self: true - Realtime does not echo a client's own broadcasts back to
    // it by default, which would otherwise leave this player's own track
    // stuck at 0% forever (only ever hearing everyone else's updates).
    const channel = supabase
      .channel(`race-progress:${roundId}`, {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        const { userId: fromUserId, progressPct } = payload as ProgressPayload
        setProgress((prev) => ({ ...prev, [fromUserId]: progressPct }))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [roundId, userId])

  function sendProgress(progressPct: number) {
    if (!userId) return
    channelRef.current?.send({
      type: 'broadcast',
      event: 'progress',
      payload: { userId, progressPct } satisfies ProgressPayload,
    })
  }

  return { progress, sendProgress }
}

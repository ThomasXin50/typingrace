import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'

interface RemoveRoomBotBody {
  roomId: string
  botId: string
}

function isValidBody(body: unknown): body is RemoveRoomBotBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.roomId === 'string' &&
    b.roomId.length > 0 &&
    typeof b.botId === 'string' &&
    b.botId.length > 0
  )
}

// room_bots has no client delete policy at all - removing a bot has to go
// through the service-role client here, same no-client-write-path pattern
// the rest of multiplayer uses.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) {
      return Response.json({ error: 'unauthenticated' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 })
    }

    if (!isValidBody(body)) {
      return Response.json(
        { error: 'expected { roomId: string, botId: string }' },
        { status: 400 },
      )
    }

    const { roomId, botId } = body

    const { data: room, error: roomError } = await ctx.supabaseAdmin
      .from('rooms')
      .select('id, host_id')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      return Response.json({ error: roomError.message }, { status: 500 })
    }
    if (!room) {
      return Response.json({ error: 'room not found' }, { status: 404 })
    }
    if (room.host_id !== userId) {
      return Response.json(
        { error: 'only the host can remove bots' },
        { status: 403 },
      )
    }

    const { error: deleteError } = await ctx.supabaseAdmin
      .from('room_bots')
      .delete()
      .eq('id', botId)
      .eq('room_id', roomId)

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 })
    }

    return Response.json({ removed: true })
  }),
}

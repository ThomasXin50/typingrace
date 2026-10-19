import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { canAddBot } from './canAddBot.ts'
import { resolvePersonality } from '../_shared/botPersonalities.ts'

interface AddRoomBotBody {
  roomId: string
  personality?: string
}

function isValidBody(body: unknown): body is AddRoomBotBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (typeof b.roomId !== 'string' || b.roomId.length === 0) return false
  if ('personality' in b && typeof b.personality !== 'string') return false
  return true
}

// room_bots has no client insert policy at all (see the room_bots
// migration) - adding a bot has to go through the service-role client
// here, same no-client-write-path pattern the rest of multiplayer uses.
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
        { error: 'expected { roomId: string, personality?: string }' },
        { status: 400 },
      )
    }

    const { roomId, personality: requestedPersonality } = body

    const { data: room, error: roomError } = await ctx.supabaseAdmin
      .from('rooms')
      .select('id, host_id, max_players')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      return Response.json({ error: roomError.message }, { status: 500 })
    }
    if (!room) {
      return Response.json({ error: 'room not found' }, { status: 404 })
    }

    const personality = resolvePersonality(requestedPersonality)
    if (personality === null) {
      return Response.json(
        { error: 'unknown bot personality requested' },
        { status: 400 },
      )
    }

    const [membersResult, botsResult] = await Promise.all([
      ctx.supabaseAdmin
        .from('room_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('room_id', roomId),
      ctx.supabaseAdmin
        .from('room_bots')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId),
    ])

    if (membersResult.error) {
      return Response.json(
        { error: membersResult.error.message },
        { status: 500 },
      )
    }
    if (botsResult.error) {
      return Response.json({ error: botsResult.error.message }, { status: 500 })
    }

    const decision = canAddBot({
      requesterId: userId,
      hostId: room.host_id,
      memberCount: membersResult.count ?? 0,
      botCount: botsResult.count ?? 0,
      maxPlayers: room.max_players,
    })

    if (!decision.allowed) {
      const status =
        decision.reason === 'only the host can add bots' ? 403 : 409
      return Response.json({ error: decision.reason }, { status })
    }

    const { data: bot, error: insertError } = await ctx.supabaseAdmin
      .from('room_bots')
      .insert({ room_id: roomId, personality })
      .select()
      .single()

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    return Response.json({
      id: bot.id,
      roomId: bot.room_id,
      personality: bot.personality,
    })
  }),
}

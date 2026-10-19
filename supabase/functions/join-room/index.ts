import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { canJoin } from './canJoin.ts'

interface JoinRoomBody {
  joinCode: string
}

function isValidBody(body: unknown): body is JoinRoomBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.joinCode === 'string' && b.joinCode.trim().length > 0
}

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
        { error: 'expected { joinCode: string }' },
        { status: 400 },
      )
    }

    const joinCode = body.joinCode.trim().toUpperCase()

    const { data: room, error: roomError } = await ctx.supabaseAdmin
      .from('rooms')
      .select('id, max_players, join_code, status, host_id, difficulty_filter')
      .eq('join_code', joinCode)
      .maybeSingle()

    if (roomError) {
      return Response.json({ error: roomError.message }, { status: 500 })
    }
    if (!room) {
      return Response.json({ error: 'room not found' }, { status: 404 })
    }

    const [membersResult, botsResult] = await Promise.all([
      ctx.supabaseAdmin
        .from('room_members')
        .select('user_id')
        .eq('room_id', room.id),
      ctx.supabaseAdmin
        .from('room_bots')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', room.id),
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

    const members = membersResult.data
    const alreadyMember = members.some((m) => m.user_id === userId)
    // Bots occupy a capacity seat the same as a human member - see
    // src/features/multiplayer/CLAUDE.md.
    const decision = canJoin({
      memberCount: members.length + (botsResult.count ?? 0),
      maxPlayers: room.max_players,
      alreadyMember,
    })

    if (!decision.allowed) {
      return Response.json({ error: decision.reason }, { status: 409 })
    }

    if (!alreadyMember) {
      const { error: insertError } = await ctx.supabaseAdmin
        .from('room_members')
        .insert({ room_id: room.id, user_id: userId })

      if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 })
      }
    }

    return Response.json({
      id: room.id,
      joinCode: room.join_code,
      maxPlayers: room.max_players,
      difficultyFilter: room.difficulty_filter,
      status: room.status,
      hostId: room.host_id,
    })
  }),
}

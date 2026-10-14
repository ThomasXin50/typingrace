import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { pickText } from './pickText.ts'

const COUNTDOWN_MS = 5000

interface StartRaceBody {
  roomId: string
}

function isValidBody(body: unknown): body is StartRaceBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.roomId === 'string' && b.roomId.length > 0
}

// rooms/rounds/round_participants have no client insert/update policy at
// all - starting a race (picking the text, anchoring the synchronized
// countdown, enrolling every current member) has to be one atomic,
// server-controlled sequence here, same no-client-write-path pattern the
// rest of multiplayer and solo_runs use.
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
        { error: 'expected { roomId: string }' },
        { status: 400 },
      )
    }

    const { roomId } = body

    const { data: room, error: roomError } = await ctx.supabaseAdmin
      .from('rooms')
      .select('id, host_id, status, difficulty_filter')
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
        { error: 'only the host can start the race' },
        { status: 403 },
      )
    }
    if (room.status !== 'lobby') {
      return Response.json(
        { error: 'a race is already in progress for this room' },
        { status: 409 },
      )
    }

    const { data: texts, error: textsError } = await ctx.supabaseAdmin
      .from('texts')
      .select('id, content, difficulty_rating')
      .eq('status', 'approved')

    if (textsError) {
      return Response.json({ error: textsError.message }, { status: 500 })
    }
    if (!texts || texts.length === 0) {
      return Response.json(
        { error: 'no approved texts are available' },
        { status: 400 },
      )
    }

    const textId = pickText(texts, room.difficulty_filter)
    const text = texts.find((t) => t.id === textId)!

    const startedAt = new Date(Date.now() + COUNTDOWN_MS).toISOString()

    const { data: round, error: roundError } = await ctx.supabaseAdmin
      .from('rounds')
      .insert({ room_id: roomId, text_id: textId, started_at: startedAt })
      .select()
      .single()

    if (roundError) {
      return Response.json({ error: roundError.message }, { status: 500 })
    }

    const { data: members, error: membersError } = await ctx.supabaseAdmin
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('status', 'active')

    if (membersError) {
      return Response.json({ error: membersError.message }, { status: 500 })
    }

    const { error: participantsError } = await ctx.supabaseAdmin
      .from('round_participants')
      .insert(members.map((m) => ({ round_id: round.id, user_id: m.user_id })))

    if (participantsError) {
      return Response.json(
        { error: participantsError.message },
        { status: 500 },
      )
    }

    const { error: roomUpdateError } = await ctx.supabaseAdmin
      .from('rooms')
      .update({ status: 'racing' })
      .eq('id', roomId)

    if (roomUpdateError) {
      return Response.json({ error: roomUpdateError.message }, { status: 500 })
    }

    return Response.json({
      roundId: round.id,
      textContent: text.content,
      startedAt,
    })
  }),
}

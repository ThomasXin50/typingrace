import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { resolvePersonality } from '../_shared/botPersonalities.ts'
import { generateJoinCode } from './joinCode.ts'

interface CreateRoomBody {
  maxPlayers?: number
  difficultyFilter?: 'easy' | 'normal' | 'hard' | 'all'
}

const DIFFICULTY_FILTERS = ['easy', 'normal', 'hard', 'all']

function isValidBody(body: unknown): body is CreateRoomBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (
    'maxPlayers' in b &&
    (typeof b.maxPlayers !== 'number' || b.maxPlayers < 2 || b.maxPlayers > 10)
  ) {
    return false
  }
  if (
    'difficultyFilter' in b &&
    (typeof b.difficultyFilter !== 'string' ||
      !DIFFICULTY_FILTERS.includes(b.difficultyFilter))
  ) {
    return false
  }
  return true
}

const MAX_JOIN_CODE_ATTEMPTS = 5

// rooms/room_members have no client insert policy at all (see the
// multiplayer schema migration) - creating a room, and auto-joining its
// host, both have to go through the service-role client here, same
// no-client-write-path pattern submit-solo-run uses for solo_runs.
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
      body = {}
    }

    if (!isValidBody(body)) {
      return Response.json(
        {
          error:
            'maxPlayers must be 2-10 and difficultyFilter must be a known filter',
        },
        { status: 400 },
      )
    }

    const { maxPlayers, difficultyFilter } = body

    let room = null
    for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
      const { data, error } = await ctx.supabaseAdmin
        .from('rooms')
        .insert({
          host_id: userId,
          join_code: generateJoinCode(),
          ...(maxPlayers !== undefined && { max_players: maxPlayers }),
          ...(difficultyFilter !== undefined && {
            difficulty_filter: difficultyFilter,
          }),
        })
        .select()
        .single()

      if (!error) {
        room = data
        break
      }
      // 23505 = unique_violation - a join_code collision, vanishingly rare
      // but worth a bounded retry rather than failing the whole request.
      if (error.code !== '23505') {
        return Response.json({ error: error.message }, { status: 500 })
      }
    }

    if (!room) {
      return Response.json(
        { error: 'failed to generate a unique room code, please try again' },
        { status: 500 },
      )
    }

    const { error: memberError } = await ctx.supabaseAdmin
      .from('room_members')
      .insert({ room_id: room.id, user_id: userId })

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 500 })
    }

    // Every new room starts with one bot already in the lobby, so a host
    // racing solo still has someone to race - see
    // src/features/multiplayer/CLAUDE.md.
    const { error: botError } = await ctx.supabaseAdmin
      .from('room_bots')
      .insert({ room_id: room.id, personality: resolvePersonality(undefined) })

    if (botError) {
      return Response.json({ error: botError.message }, { status: 500 })
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

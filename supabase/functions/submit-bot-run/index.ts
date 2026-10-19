import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'

interface SubmitBotRunBody {
  roundId: string
  botId: string
  wpm: number
  rawWpm: number
  accuracy: number
  errorCount: number
}

function isValidBody(body: unknown): body is SubmitBotRunBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.roundId === 'string' &&
    b.roundId.length > 0 &&
    typeof b.botId === 'string' &&
    b.botId.length > 0 &&
    typeof b.wpm === 'number' &&
    typeof b.rawWpm === 'number' &&
    typeof b.accuracy === 'number' &&
    typeof b.errorCount === 'number'
  )
}

// Unlike submit-round-run/submit-solo-run, this never re-validates the
// submitted numbers against a raw keystroke log - a bot's run is
// deterministically simulated client-side (see
// src/features/multiplayer/botSimulation.ts), and its live pace is
// adjusted by rubber-banding against the human players' progress, which
// is broadcast-only and never reaches Postgres. There is nothing for the
// server to recompute from. This is safe specifically because a bot's
// result affects no real player's stats - it never touches solo_runs,
// profile stats, or any leaderboard (see #66) - so the "trust nothing the
// client reports" principle elsewhere in this app does not apply here.
// What the server *does* own is the only part that is genuinely
// concurrency-sensitive: assigning a correct placement/field_size across
// humans and bots together, via the security-definer finish_round_bot().
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
        {
          error:
            'expected { roundId, botId, wpm, rawWpm, accuracy, errorCount }',
        },
        { status: 400 },
      )
    }

    const { roundId, botId, wpm, rawWpm, accuracy, errorCount } = body

    const { data: round, error: roundError } = await ctx.supabaseAdmin
      .from('rounds')
      .select('id, room_id, status')
      .eq('id', roundId)
      .maybeSingle()

    if (roundError) {
      return Response.json({ error: roundError.message }, { status: 500 })
    }
    if (!round) {
      return Response.json({ error: 'round not found' }, { status: 404 })
    }

    const { data: membership, error: membershipError } = await ctx.supabaseAdmin
      .from('room_members')
      .select('user_id')
      .eq('room_id', round.room_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      return Response.json({ error: membershipError.message }, { status: 500 })
    }
    if (!membership) {
      return Response.json(
        { error: 'you are not a member of this room' },
        { status: 403 },
      )
    }

    const { data: bot, error: botError } = await ctx.supabaseAdmin
      .from('room_bots')
      .select('id, personality')
      .eq('id', botId)
      .eq('room_id', round.room_id)
      .maybeSingle()

    if (botError) {
      return Response.json({ error: botError.message }, { status: 500 })
    }
    if (!bot) {
      return Response.json(
        { error: "bot not found in this round's room" },
        { status: 404 },
      )
    }

    const { data: result, error: finishError } = await ctx.supabaseAdmin.rpc(
      'finish_round_bot',
      {
        p_round_id: roundId,
        p_bot_id: botId,
        p_personality: bot.personality,
        p_wpm: wpm,
        p_raw_wpm: rawWpm,
        p_accuracy: accuracy,
        p_error_count: errorCount,
      },
    )

    if (finishError || !result || result.length === 0) {
      return Response.json(
        { error: finishError?.message ?? 'failed to record bot result' },
        { status: 500 },
      )
    }

    const { placement, field_size: fieldSize } = result[0]

    return Response.json({ placement, fieldSize })
  }),
}

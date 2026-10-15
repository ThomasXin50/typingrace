import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { completeRoundIfDone } from '../_shared/completeRound.ts'

interface StallBody {
  roundId: string
}

function isValidBody(body: unknown): body is StallBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.roundId === 'string' && b.roundId.length > 0
}

// Self-only by construction: the body carries no target user id, so there
// is no way to stall anyone but the caller themselves - ctx.userClaims.id
// is the only id ever passed to stall_round_participant(). Same
// no-client-write-path pattern as every other multiplayer table: the RPC
// itself is security definer with execute revoked from anon/authenticated,
// callable only via this service-role client.
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
        { error: 'expected { roundId: string }' },
        { status: 400 },
      )
    }

    const { roundId } = body

    const { data: participant, error: participantError } =
      await ctx.supabaseAdmin
        .from('round_participants')
        .select('status')
        .eq('round_id', roundId)
        .eq('user_id', userId)
        .maybeSingle()

    if (participantError) {
      return Response.json({ error: participantError.message }, { status: 500 })
    }
    if (!participant) {
      return Response.json(
        { error: 'you are not enrolled in this round' },
        { status: 403 },
      )
    }

    const { data: round, error: roundError } = await ctx.supabaseAdmin
      .from('rounds')
      .select('room_id')
      .eq('id', roundId)
      .maybeSingle()

    if (roundError) {
      return Response.json({ error: roundError.message }, { status: 500 })
    }
    if (!round) {
      return Response.json({ error: 'round not found' }, { status: 404 })
    }

    const { error: stallError } = await ctx.supabaseAdmin.rpc(
      'stall_round_participant',
      { p_round_id: roundId, p_user_id: userId },
    )

    if (stallError) {
      return Response.json({ error: stallError.message }, { status: 500 })
    }

    await completeRoundIfDone(ctx.supabaseAdmin, roundId, round.room_id)

    return Response.json({ status: 'stalled' })
  }),
}

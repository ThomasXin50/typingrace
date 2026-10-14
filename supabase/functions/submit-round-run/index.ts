import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import {
  assessValidation,
  computeStats,
  type Keystroke,
} from '../_shared/validate.ts'

interface SubmitBody {
  roundId: string
  keystrokes: Keystroke[]
}

function isValidBody(body: unknown): body is SubmitBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (typeof b.roundId !== 'string') return false
  if (!Array.isArray(b.keystrokes)) return false
  return b.keystrokes.every(
    (k) =>
      typeof k === 'object' &&
      k !== null &&
      typeof (k as Keystroke).key === 'string' &&
      typeof (k as Keystroke).timestamp === 'number' &&
      typeof (k as Keystroke).trusted === 'boolean',
  )
}

// Same no-client-write-path pattern as submit-solo-run: round_participants
// has no client insert/update policy, and placement/field_size are
// assigned by the security-definer finish_round_participant() function
// (execute revoked from anon/authenticated), callable only via this
// service-role client - never directly by a browser.
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
        { error: 'expected { roundId: string, keystrokes: Keystroke[] }' },
        { status: 400 },
      )
    }

    const { roundId, keystrokes } = body

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
    if (participant.status !== 'racing') {
      return Response.json(
        { error: 'you have already submitted a result for this round' },
        { status: 409 },
      )
    }

    const { data: round, error: roundError } = await ctx.supabaseAdmin
      .from('rounds')
      .select('id, room_id, text_id, status, started_at')
      .eq('id', roundId)
      .maybeSingle()

    if (roundError) {
      return Response.json({ error: roundError.message }, { status: 500 })
    }
    if (!round || round.status !== 'active') {
      return Response.json(
        { error: 'this round is not active' },
        { status: 400 },
      )
    }

    const { data: text, error: textError } = await ctx.supabaseAdmin
      .from('texts')
      .select('content')
      .eq('id', round.text_id)
      .single()

    if (textError || !text) {
      return Response.json({ error: 'round text not found' }, { status: 500 })
    }

    const stats = computeStats(
      text.content,
      keystrokes,
      Date.parse(round.started_at),
    )

    if (!stats.finished) {
      return Response.json(
        { error: 'run never reached the end of the text' },
        { status: 400 },
      )
    }

    const { status, reason } = assessValidation(keystrokes, stats)

    const { data: result, error: finishError } = await ctx.supabaseAdmin.rpc(
      'finish_round_participant',
      {
        p_round_id: roundId,
        p_user_id: userId,
        p_status: 'finished',
        p_validation_status: status,
        p_wpm: stats.wpm,
        p_accuracy: stats.accuracy,
      },
    )

    if (finishError || !result || result.length === 0) {
      return Response.json(
        { error: finishError?.message ?? 'failed to record result' },
        { status: 500 },
      )
    }

    const { placement, field_size: fieldSize } = result[0]

    // Best-effort round completion check: once nobody enrolled is still
    // racing, close the round out and free the room for a next race. Not
    // atomic with the update above - a harmless no-op if it ever runs
    // twice. No stalled-participant detection exists yet, so a round where
    // someone abandons without finishing currently never completes (same
    // limitation already noted when start-race shipped).
    const { count: stillRacing } = await ctx.supabaseAdmin
      .from('round_participants')
      .select('user_id', { count: 'exact', head: true })
      .eq('round_id', roundId)
      .eq('status', 'racing')

    if (stillRacing === 0) {
      await ctx.supabaseAdmin
        .from('rounds')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', roundId)

      await ctx.supabaseAdmin
        .from('rooms')
        .update({ status: 'lobby' })
        .eq('id', round.room_id)
    }

    return Response.json({
      status,
      reason,
      wpm: stats.wpm,
      rawWpm: stats.rawWpm,
      accuracy: stats.accuracy,
      durationMs: stats.durationMs,
      errorCount: stats.errorCount,
      placement,
      fieldSize,
    })
  }),
}

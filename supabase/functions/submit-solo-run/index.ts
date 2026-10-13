// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { assessValidation, computeStats, type Keystroke } from './validate.ts'

interface SubmitBody {
  textId: string
  keystrokes: Keystroke[]
}

function isValidBody(body: unknown): body is SubmitBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (typeof b.textId !== 'string') return false
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

// The only write path to solo_runs: it has no client-side insert policy at
// all, so every result - solo or (later) multiplayer - is written here with
// the service-role client, never by the browser directly. The client never
// reports its own wpm/accuracy; everything is recomputed from the raw
// keystroke log, which is discarded (never persisted) after validation.
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
        { error: 'expected { textId: string, keystrokes: Keystroke[] }' },
        { status: 400 },
      )
    }

    const { textId, keystrokes } = body

    const { data: text, error: textError } = await ctx.supabaseAdmin
      .from('texts')
      .select('id, content, status')
      .eq('id', textId)
      .single()

    if (textError || !text || text.status !== 'approved') {
      return Response.json(
        { error: 'text not found or not approved' },
        { status: 400 },
      )
    }

    const stats = computeStats(text.content, keystrokes)

    if (!stats.finished) {
      return Response.json(
        { error: 'run never reached the end of the text' },
        { status: 400 },
      )
    }

    const { status, reason } = assessValidation(keystrokes, stats)

    const { error: insertError } = await ctx.supabaseAdmin
      .from('solo_runs')
      .insert({
        user_id: userId,
        text_id: textId,
        wpm: stats.wpm,
        raw_wpm: stats.rawWpm,
        accuracy: stats.accuracy,
        duration_ms: Math.max(1, Math.round(stats.durationMs)),
        error_count: stats.errorCount,
        validation_status: status,
      })

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    return Response.json({
      status,
      reason,
      wpm: stats.wpm,
      rawWpm: stats.rawWpm,
      accuracy: stats.accuracy,
      durationMs: stats.durationMs,
      errorCount: stats.errorCount,
    })
  }),
}

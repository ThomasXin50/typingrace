import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'

interface HeartbeatBody {
  roomId: string
}

function isValidBody(body: unknown): body is HeartbeatBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.roomId === 'string' && b.roomId.length > 0
}

// Self-only by construction: the body carries no target user id, so there
// is no way to bump anyone's heartbeat but the caller's own -
// ctx.userClaims.id is the only id ever passed to touch_room_member(). Same
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
        { error: 'expected { roomId: string }' },
        { status: 400 },
      )
    }

    const { roomId } = body

    const { data: member, error: memberError } = await ctx.supabaseAdmin
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 500 })
    }
    if (!member) {
      return Response.json(
        { error: 'you are not a member of this room' },
        { status: 403 },
      )
    }

    const { error: touchError } = await ctx.supabaseAdmin.rpc(
      'touch_room_member',
      { p_room_id: roomId, p_user_id: userId },
    )

    if (touchError) {
      return Response.json({ error: touchError.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  }),
}

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { planLeave } from './leaveRoom.ts'

interface LeaveRoomBody {
  roomId: string
}

function isValidBody(body: unknown): body is LeaveRoomBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.roomId === 'string' && b.roomId.length > 0
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
        { error: 'expected { roomId: string }' },
        { status: 400 },
      )
    }

    const { roomId } = body

    const { data: room, error: roomError } = await ctx.supabaseAdmin
      .from('rooms')
      .select('id, host_id')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      return Response.json({ error: roomError.message }, { status: 500 })
    }
    if (!room) {
      return Response.json({ left: true, roomDeleted: false })
    }

    const { error: deleteMemberError } = await ctx.supabaseAdmin
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)

    if (deleteMemberError) {
      return Response.json(
        { error: deleteMemberError.message },
        { status: 500 },
      )
    }

    const { data: remainingMembers, error: remainingError } =
      await ctx.supabaseAdmin
        .from('room_members')
        .select('user_id, joined_at')
        .eq('room_id', roomId)

    if (remainingError) {
      return Response.json({ error: remainingError.message }, { status: 500 })
    }

    const plan = planLeave({
      hostId: room.host_id,
      leavingUserId: userId,
      remaining: remainingMembers.map((m) => ({
        userId: m.user_id,
        joinedAt: m.joined_at,
      })),
    })

    if (plan.deleteRoom) {
      const { error: deleteRoomError } = await ctx.supabaseAdmin
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (deleteRoomError) {
        return Response.json(
          { error: deleteRoomError.message },
          { status: 500 },
        )
      }
    } else if (plan.newHostId) {
      const { error: transferError } = await ctx.supabaseAdmin
        .from('rooms')
        .update({ host_id: plan.newHostId })
        .eq('id', roomId)

      if (transferError) {
        return Response.json({ error: transferError.message }, { status: 500 })
      }
    }

    return Response.json({ left: true, roomDeleted: plan.deleteRoom })
  }),
}

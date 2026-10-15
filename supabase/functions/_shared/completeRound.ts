// Narrow structural slice of SupabaseClient covering just the calls this
// helper makes - avoids depending on the full @supabase/supabase-js type
// (not imported anywhere else in this codebase's Edge Functions either).
interface MinimalSupabaseAdmin {
  from(table: string): {
    select(
      columns: string,
      options?: { count?: 'exact'; head?: boolean },
    ): {
      eq(
        column: string,
        value: string,
      ): {
        eq(column: string, value: string): Promise<{ count: number | null }>
      }
    }
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): Promise<unknown>
    }
  }
}

// Round-completion check, shared by every path that can take a
// round_participants row out of 'racing' (a real finish via
// submit-round-run, or a stall via stall-round-participant). Once nobody
// enrolled is still racing, the round closes out and the room frees up for
// a next race. Not atomic with whatever caller just updated this
// participant's row - a harmless no-op if it ever runs twice.
export async function completeRoundIfDone(
  supabaseAdmin: MinimalSupabaseAdmin,
  roundId: string,
  roomId: string,
): Promise<void> {
  const { count: stillRacing } = await supabaseAdmin
    .from('round_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .eq('status', 'racing')

  if (stillRacing === 0) {
    await supabaseAdmin
      .from('rounds')
      .update({ status: 'finished', ended_at: new Date().toISOString() })
      .eq('id', roundId)

    await supabaseAdmin
      .from('rooms')
      .update({ status: 'lobby' })
      .eq('id', roomId)
  }
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { displayName } from '../../lib/displayName'
import { useProfile } from '../auth/useProfile'
import { RacePage } from './RacePage'
import { clearCurrentRoomId, setCurrentRoomId } from './currentRoom'
import { useLeaveRoom } from './useLeaveRoom'
import { useRoom } from './useRoom'
import { useStartRace } from './useStartRace'
import './multiplayer.css'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { room, members, loading, error } = useRoom(roomId!)
  const leaveRoomState = useLeaveRoom()
  const startRaceState = useStartRace()
  const [inRace, setInRace] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  // currentRoom is what the app-level heartbeat/unload-leave hooks (see
  // App.tsx) read to know which room to act on - this is the one place
  // that keeps it in sync with the room this page actually loaded.
  useEffect(() => {
    if (room) setCurrentRoomId(room.id)
  }, [room])

  // The room is confirmed gone (not just still loading) - e.g. the sweep
  // removed this player while they were away, or the host deleted it.
  // Clearing here is what makes a visit to /multiplayer self-heal instead
  // of looping back into a dead room forever.
  useEffect(() => {
    if (!loading && !error && !room) clearCurrentRoomId()
  }, [loading, error, room])

  if (loading) {
    return <p className="page-status">Loading room…</p>
  }

  if (error || !room) {
    return (
      <p className="page-status" role="alert">
        {error ?? 'Room not found'}
      </p>
    )
  }

  // Adjust state during render: once entered, the race page owns its own
  // exit (it shows a grace-period "back to lobby" countdown after this
  // player finishes) rather than disappearing the instant room.status
  // flips back to 'lobby' - which happens as soon as everyone else
  // finishes too, well before any single player has had a moment to look
  // at their own results.
  if (room.status === 'racing' && !inRace) {
    setInRace(true)
  }

  if (inRace) {
    return <RacePage roomId={room.id} onDone={() => setInRace(false)} />
  }

  const listing = members.map((m) => ({
    user_id: m.user_id,
    is_anonymous: m.is_anonymous,
  }))
  const isHost = profile?.id === room.host_id

  return (
    <div className="room-page">
      <div className="room-page__header">
        <h2>Room code</h2>
        <span className="room-page__join-code">{room.join_code}</span>
        <p className="room-page__hint">
          Share this code with people you want to race.
        </p>
      </div>

      <ul className="room-roster">
        {members.map((member) => (
          <li key={member.user_id} className="room-roster__item">
            <span>{displayName(member, listing)}</span>
            {member.user_id === room.host_id && (
              <span className="room-roster__host-tag">Host</span>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <button
          type="button"
          className="btn"
          disabled={startRaceState.starting}
          onClick={() => startRaceState.startRace(room.id)}
        >
          {startRaceState.starting ? 'Starting…' : 'Start Race'}
        </button>
      )}
      {startRaceState.error && (
        <p className="page-status" role="alert">
          {startRaceState.error}
        </p>
      )}

      {confirmingLeave ? (
        <div className="room-page__leave-confirm">
          <p className="room-page__leave-confirm-text">
            You're the host - leaving will transfer host to another player.
            Continue?
          </p>
          <div className="room-page__leave-confirm-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingLeave(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={leaveRoomState.leaving}
              onClick={() =>
                leaveRoomState.leaveRoom(room.id, () => {
                  clearCurrentRoomId()
                  navigate('/multiplayer')
                })
              }
            >
              {leaveRoomState.leaving ? 'Leaving…' : 'Leave anyway'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={leaveRoomState.leaving}
          onClick={() => {
            if (isHost && members.length > 1) {
              setConfirmingLeave(true)
              return
            }
            leaveRoomState.leaveRoom(room.id, () => {
              clearCurrentRoomId()
              navigate('/multiplayer')
            })
          }}
        >
          {leaveRoomState.leaving ? 'Leaving…' : 'Leave room'}
        </button>
      )}
      {leaveRoomState.error && (
        <p className="page-status" role="alert">
          {leaveRoomState.error}
        </p>
      )}
    </div>
  )
}

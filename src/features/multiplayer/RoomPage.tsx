import { useNavigate, useParams } from 'react-router-dom'
import { displayName } from '../../lib/displayName'
import { useProfile } from '../auth/useProfile'
import { RacePage } from './RacePage'
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

  if (room.status === 'racing') {
    return <RacePage roomId={room.id} />
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

      <button
        type="button"
        className="btn"
        disabled={leaveRoomState.leaving}
        onClick={() =>
          leaveRoomState.leaveRoom(room.id, () => navigate('/multiplayer'))
        }
      >
        {leaveRoomState.leaving ? 'Leaving…' : 'Leave room'}
      </button>
      {leaveRoomState.error && (
        <p className="page-status" role="alert">
          {leaveRoomState.error}
        </p>
      )}
    </div>
  )
}

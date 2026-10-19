import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { displayName } from '../../lib/displayName'
import { useProfile } from '../auth/useProfile'
import {
  BOT_PERSONALITIES,
  BOT_PERSONALITY_NAMES,
  MAX_BOTS_PER_ROOM,
  botDisplayName,
  type BotPersonality,
} from './botPersonalities'
import { RacePage } from './RacePage'
import { clearCurrentRoomId, setCurrentRoomId } from './currentRoom'
import { useAddBot } from './useAddBot'
import { useExitingList } from './useExitingList'
import { useLeaveRoom } from './useLeaveRoom'
import { useRemoveBot } from './useRemoveBot'
import { useRoom } from './useRoom'
import { useStartRace } from './useStartRace'
import './multiplayer.css'

const ROSTER_EXIT_MS = 250
const HOST_FLASH_MS = 900

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { room, members, bots = [], loading, error } = useRoom(roomId!)
  const leaveRoomState = useLeaveRoom()
  const startRaceState = useStartRace()
  const addBotState = useAddBot()
  const removeBotState = useRemoveBot()
  const [inRace, setInRace] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [pickedPersonality, setPickedPersonality] = useState<
    'random' | BotPersonality
  >('random')

  // Adjust state during render: if whoever else was in the room leaves
  // (voluntarily, stalls out of the race, or gets swept for going quiet)
  // while this host is still looking at the leave confirmation, there's
  // no one left to warn about transferring host to - dismiss it rather
  // than leave it showing stale text ("leaving will transfer host...")
  // when leaving now would actually just delete the room instead.
  if (confirmingLeave && members.length <= 1) setConfirmingLeave(false)

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

  // Calls out a roster row that just became the new host (e.g. the
  // previous host left) - a genuinely surprising state change otherwise
  // easy to miss, since nothing else about the roster changed.
  const previousHostIdRef = useRef<string | null>(null)
  const [justTransferredHostId, setJustTransferredHostId] = useState<
    string | null
  >(null)

  useEffect(() => {
    const hostId = room?.host_id ?? null
    const prevHostId = previousHostIdRef.current
    previousHostIdRef.current = hostId

    if (prevHostId === null || hostId === null || prevHostId === hostId) {
      return
    }

    setJustTransferredHostId(hostId)
    const timeout = setTimeout(
      () => setJustTransferredHostId(null),
      HOST_FLASH_MS,
    )
    return () => clearTimeout(timeout)
  }, [room?.host_id])

  // Lets a departing member's row fade out instead of vanishing the
  // instant they're gone from `members` - see useExitingList.
  const rosterEntries = useExitingList(
    members,
    (member) => member.user_id,
    ROSTER_EXIT_MS,
  )

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
        <span className="room-page__join-code panel-enter">
          {room.join_code}
        </span>
        <p className="room-page__hint">
          Share this code with people you want to race.
        </p>
      </div>

      <ul className="room-roster">
        {rosterEntries.map(({ key, item: member, leaving }) => (
          <li
            key={key}
            className={[
              'room-roster__item',
              'panel-enter',
              leaving && 'room-roster__item--leaving',
              member.user_id === justTransferredHostId && 'attention-flash',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span>{displayName(member, listing)}</span>
            {member.user_id === room.host_id && (
              <span className="room-roster__host-tag">Host</span>
            )}
          </li>
        ))}
        {bots.map((bot) => (
          <li key={bot.id} className="room-roster__item panel-enter">
            <span>
              <span aria-hidden="true">🤖 </span>
              {botDisplayName(bot, bots)}
            </span>
            {isHost && (
              <button
                type="button"
                className="btn"
                disabled={removeBotState.removing}
                onClick={() => removeBotState.removeBot(room.id, bot.id)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <div className="room-page__add-bot">
          <select
            className="room-page__bot-picker"
            aria-label="Bot personality"
            value={pickedPersonality}
            onChange={(e) =>
              setPickedPersonality(e.target.value as 'random' | BotPersonality)
            }
          >
            <option value="random">Random</option>
            {BOT_PERSONALITIES.map((personality) => (
              <option key={personality} value={personality}>
                {BOT_PERSONALITY_NAMES[personality]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={addBotState.adding || bots.length >= MAX_BOTS_PER_ROOM}
            onClick={() =>
              addBotState.addBot(
                room.id,
                pickedPersonality === 'random' ? undefined : pickedPersonality,
              )
            }
          >
            {addBotState.adding ? 'Adding…' : 'Add bot'}
          </button>
        </div>
      )}
      {addBotState.error && (
        <p className="page-status" role="alert">
          {addBotState.error}
        </p>
      )}
      {removeBotState.error && (
        <p className="page-status" role="alert">
          {removeBotState.error}
        </p>
      )}

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
        <div className="room-page__leave-confirm panel-enter">
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

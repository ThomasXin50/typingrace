import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRoomId } from './currentRoom'
import { useCreateRoom } from './useCreateRoom'
import { useJoinRoom } from './useJoinRoom'
import './multiplayer.css'

export function MultiplayerPage() {
  const navigate = useNavigate()
  const createRoomState = useCreateRoom()
  const joinRoomState = useJoinRoom()
  const [joinCodeInput, setJoinCodeInput] = useState('')
  // Read once at mount, same lazy-initializer shape useTheme uses for its
  // own localStorage read - not on every render.
  const [existingRoomId] = useState(getCurrentRoomId)

  // A player who's already in a room (even if they navigated away from it
  // in-app) lands back in it directly, skipping this entry form entirely -
  // replace: true so the browser back button doesn't bounce between the
  // two.
  useEffect(() => {
    if (existingRoomId) {
      navigate(`/multiplayer/${existingRoomId}`, { replace: true })
    }
  }, [existingRoomId, navigate])

  useEffect(() => {
    if (createRoomState.room)
      navigate(`/multiplayer/${createRoomState.room.id}`)
  }, [createRoomState.room, navigate])

  useEffect(() => {
    if (joinRoomState.room) navigate(`/multiplayer/${joinRoomState.room.id}`)
  }, [joinRoomState.room, navigate])

  if (existingRoomId) {
    return <p className="page-status">Returning to your room…</p>
  }

  return (
    <div className="multiplayer-entry">
      <section className="multiplayer-entry__panel">
        <h2>Host a race</h2>
        <p className="multiplayer-entry__hint">
          Start a private room and share the code with people you want to race.
        </p>
        <button
          type="button"
          className="btn"
          disabled={createRoomState.creating}
          onClick={() => createRoomState.createRoom()}
        >
          {createRoomState.creating ? 'Creating…' : 'Create a room'}
        </button>
        {createRoomState.error && (
          <p className="page-status" role="alert">
            {createRoomState.error}
          </p>
        )}
      </section>

      <section className="multiplayer-entry__panel">
        <h2>Join a race</h2>
        <form
          className="multiplayer-entry__join-form"
          onSubmit={(e) => {
            e.preventDefault()
            joinRoomState.joinRoom(joinCodeInput)
          }}
        >
          <label htmlFor="join-code">Room code</label>
          <div className="multiplayer-entry__join-row">
            <input
              id="join-code"
              className="multiplayer-entry__join-input"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              className="btn"
              disabled={
                joinRoomState.joining || joinCodeInput.trim().length === 0
              }
            >
              {joinRoomState.joining ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
        {joinRoomState.error && (
          <p className="page-status" role="alert">
            {joinRoomState.error}
          </p>
        )}
      </section>
    </div>
  )
}

import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { NavBar } from './app/NavBar'
import { useProfile } from './features/auth/useProfile'
import { HomePage } from './features/home/HomePage'
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage'
import { MultiplayerPage } from './features/multiplayer/MultiplayerPage'
import { RoomPage } from './features/multiplayer/RoomPage'
import { PracticePage } from './features/practice/PracticePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SoloPage } from './features/solo/SoloPage'

function App() {
  const { profile, loading, error } = useProfile()

  return (
    <BrowserRouter>
      <main className="app">
        <NavBar
          username={profile?.username}
          isAnonymous={profile?.isAnonymous}
        />
        {loading && <p className="page-status">Loading...</p>}
        {error && (
          <p className="page-status" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/solo" element={<SoloPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/leaderboards" element={<LeaderboardPage />} />
            <Route path="/multiplayer" element={<MultiplayerPage />} />
            <Route path="/multiplayer/:roomId" element={<RoomPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        )}
      </main>
    </BrowserRouter>
  )
}

export default App

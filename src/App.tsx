import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { NavBar } from './app/NavBar'
import { useProfile } from './features/auth/useProfile'
import { HomePage } from './features/home/HomePage'
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage'
import { MultiplayerPage } from './features/multiplayer/MultiplayerPage'
import { SoloTypingTest } from './features/typing/SoloTypingTest'

function App() {
  const { profile, loading, error } = useProfile()

  return (
    <BrowserRouter>
      <main className="app">
        <NavBar username={profile?.username} />
        {loading && <p className="page-status">Loading...</p>}
        {error && (
          <p className="page-status" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/practice" element={<SoloTypingTest />} />
            <Route path="/leaderboards" element={<LeaderboardPage />} />
            <Route path="/multiplayer" element={<MultiplayerPage />} />
          </Routes>
        )}
      </main>
    </BrowserRouter>
  )
}

export default App

import './App.css'
import { useProfile } from './features/auth/useProfile'
import { SoloTypingTest } from './features/typing/SoloTypingTest'

function App() {
  const { profile, loading, error } = useProfile()

  return (
    <main className="app">
      <header className="app-header">
        <h1>Typing Race</h1>
        {profile && (
          <span className="app-header__user">{profile.username}</span>
        )}
      </header>
      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && <SoloTypingTest />}
    </main>
  )
}

export default App

import { useProfile } from './features/auth/useProfile'

function App() {
  const { profile, loading, error } = useProfile()

  return (
    <main>
      <h1>Typing Race</h1>
      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {profile && <p>Signed in as {profile.username}</p>}
    </main>
  )
}

export default App

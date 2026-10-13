import { Link } from 'react-router-dom'
import { useLeaderboard } from './useLeaderboard'
import './leaderboard.css'

export function LeaderboardPage() {
  const { entries, loading, error } = useLeaderboard()

  if (loading) {
    return <p className="page-status">Loading leaderboard…</p>
  }

  if (error) {
    return (
      <p className="page-status" role="alert">
        {error}
      </p>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        <p>No runs yet — be the first on the board.</p>
        <Link to="/practice" className="leaderboard-empty__cta">
          Start practicing
        </Link>
      </div>
    )
  }

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Typist</th>
          <th scope="col">Best wpm</th>
          <th scope="col">Avg wpm</th>
          <th scope="col">Runs</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.user_id}>
            <td>{entry.rank}</td>
            <td>{entry.username}</td>
            <td>{Math.round(entry.best_wpm)}</td>
            <td>{Math.round(entry.avg_wpm)}</td>
            <td>{entry.runs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

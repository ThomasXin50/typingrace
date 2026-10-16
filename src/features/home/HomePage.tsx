import { Link } from 'react-router-dom'
import { HeroKeyboard } from './HeroKeyboard'
import { useHomeStats } from './useHomeStats'
import './home.css'

const destinations = [
  {
    to: '/solo',
    title: 'Solo',
    description:
      'Type a random approved text. Validated and counted toward your stats and the leaderboard.',
  },
  {
    to: '/practice',
    title: 'Practice',
    description:
      'Type any text - curated or your own - fully offline. Nothing is saved.',
  },
  {
    to: '/leaderboards',
    title: 'Leaderboards',
    description: 'See the fastest verified runs across every typist.',
  },
  {
    to: '/multiplayer',
    title: 'Multiplayer',
    description: 'Race friends live in a private room.',
  },
]

export function HomePage() {
  const { stats, loading, error } = useHomeStats()

  return (
    <>
      <HeroKeyboard />

      {stats && (
        <div className="stat-row">
          <div className="stat-tile stat-tile--primary">
            <span className="stat-tile__value">
              {Math.round(stats.bestWpm)}
            </span>
            <span className="stat-tile__label">best wpm</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__value">{Math.round(stats.avgWpm)}</span>
            <span className="stat-tile__label">avg wpm</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__value">{stats.totalRuns}</span>
            <span className="stat-tile__label">runs</span>
          </div>
        </div>
      )}

      {!stats && !loading && !error && (
        <p className="stat-row-empty">
          No runs yet — head to Solo or Practice to see your stats here.
        </p>
      )}

      <ul className="home-list">
        {destinations.map((d) => (
          <li key={d.to} className="home-list__item">
            <Link to={d.to} className="home-list__link">
              <span className="home-list__title">{d.title}</span>
              <span className="home-list__description">{d.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

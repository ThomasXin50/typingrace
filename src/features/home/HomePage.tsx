import { Link } from 'react-router-dom'
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
    description: 'Race friends live in a private room. Coming soon.',
  },
]

export function HomePage() {
  return (
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
  )
}

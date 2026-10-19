import { NavLink } from 'react-router-dom'
import './NavBar.css'

const destinations = [
  { to: '/solo', label: 'Solo' },
  { to: '/practice', label: 'Practice' },
  { to: '/leaderboards', label: 'Leaderboards' },
  { to: '/multiplayer', label: 'Multiplayer' },
]

interface NavBarProps {
  username?: string
  isAnonymous?: boolean
}

export function NavBar({ username, isAnonymous }: NavBarProps) {
  const displayName = isAnonymous ? 'Guest' : username

  return (
    <header className="nav-bar">
      <NavLink to="/" className="nav-bar__brand" end>
        Typing Race
      </NavLink>
      <nav className="nav-bar__links">
        {destinations.map((d) => (
          <NavLink
            key={d.to}
            to={d.to}
            className={({ isActive }) =>
              isActive ? 'nav-bar__link nav-bar__link--active' : 'nav-bar__link'
            }
          >
            {d.label}
          </NavLink>
        ))}
      </nav>
      {displayName && (
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            isActive ? 'nav-bar__user nav-bar__user--active' : 'nav-bar__user'
          }
        >
          {displayName}
        </NavLink>
      )}
    </header>
  )
}

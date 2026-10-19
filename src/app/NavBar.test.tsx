import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders the brand link and every destination', () => {
    render(
      <MemoryRouter>
        <NavBar username="alice" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Typing Race' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Solo' })).toHaveAttribute(
      'href',
      '/solo',
    )
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'href',
      '/practice',
    )
    expect(screen.getByRole('link', { name: 'Leaderboards' })).toHaveAttribute(
      'href',
      '/leaderboards',
    )
    expect(screen.getByRole('link', { name: 'Multiplayer' })).toHaveAttribute(
      'href',
      '/multiplayer',
    )
  })

  it('shows the signed-in username, linking to the profile page', () => {
    render(
      <MemoryRouter>
        <NavBar username="alice" isAnonymous={false} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('shows "Guest" instead of the generated username for anonymous sessions', () => {
    render(
      <MemoryRouter>
        <NavBar username="user_abc123" isAnonymous={true} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Guest' })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(screen.queryByText('user_abc123')).not.toBeInTheDocument()
  })

  it('renders without a username while auth is still resolving', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'Typing Race' }),
    ).toBeInTheDocument()
  })
})

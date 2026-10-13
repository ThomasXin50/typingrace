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

  it('shows the signed-in username when provided', () => {
    render(
      <MemoryRouter>
        <NavBar username="alice" />
      </MemoryRouter>,
    )

    expect(screen.getByText('alice')).toBeInTheDocument()
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

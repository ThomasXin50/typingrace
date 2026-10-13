import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('links to practice, leaderboards, and multiplayer', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /practice/i })).toHaveAttribute(
      'href',
      '/practice',
    )
    expect(screen.getByRole('link', { name: /leaderboards/i })).toHaveAttribute(
      'href',
      '/leaderboards',
    )
    expect(screen.getByRole('link', { name: /multiplayer/i })).toHaveAttribute(
      'href',
      '/multiplayer',
    )
  })

  it('marks multiplayer as not yet available', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})

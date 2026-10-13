import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

const mocks = vi.hoisted(() => ({
  useHomeStats: vi.fn(),
}))

vi.mock('./useHomeStats', () => ({
  useHomeStats: mocks.useHomeStats,
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useHomeStats.mockReturnValue({
      stats: null,
      loading: false,
      error: null,
    })
  })

  it('links to solo, practice, leaderboards, and multiplayer', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /solo/i })).toHaveAttribute(
      'href',
      '/solo',
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
    renderHome()

    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('shows an empty state when the user has no runs yet', () => {
    renderHome()

    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument()
  })

  it('shows the stats strip when the user has runs', () => {
    mocks.useHomeStats.mockReturnValue({
      stats: { totalRuns: 7, bestWpm: 102, avgWpm: 88 },
      loading: false,
      error: null,
    })

    renderHome()

    expect(screen.getByText('102')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows neither stats nor the empty state while loading or on error', () => {
    mocks.useHomeStats.mockReturnValue({
      stats: null,
      loading: true,
      error: null,
    })

    renderHome()

    expect(screen.queryByText(/no runs yet/i)).not.toBeInTheDocument()
  })
})

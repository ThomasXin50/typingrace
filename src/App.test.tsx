import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./features/auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'user-1', username: 'alice' },
    loading: false,
    error: null,
  }),
}))

describe('App', () => {
  it('renders the heading and the signed-in username', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Typing Race' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in as alice')).toBeInTheDocument()
  })
})

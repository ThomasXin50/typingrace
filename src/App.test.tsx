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

vi.mock('./features/typing/SoloTypingTest', () => ({
  SoloTypingTest: () => <div>typing test</div>,
}))

describe('App', () => {
  it('renders the heading and the signed-in username', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Typing Race' }),
    ).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('renders the solo typing test once auth resolves', () => {
    render(<App />)
    expect(screen.getByText('typing test')).toBeInTheDocument()
  })
})

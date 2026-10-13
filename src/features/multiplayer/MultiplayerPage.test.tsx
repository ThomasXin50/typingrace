import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MultiplayerPage } from './MultiplayerPage'

describe('MultiplayerPage', () => {
  it('honestly states that multiplayer is not available yet', () => {
    render(<MultiplayerPage />)

    expect(screen.getByText(/aren't ready yet/i)).toBeInTheDocument()
  })
})

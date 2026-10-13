import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticePage } from './PracticePage'

const mocks = vi.hoisted(() => ({
  useRandomText: vi.fn(),
}))

vi.mock('../typing/useRandomText', () => ({
  useRandomText: mocks.useRandomText,
}))

describe('PracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'curated-1', content: 'the curated text' },
      loading: false,
      error: null,
      requestNext: vi.fn(),
    })
  })

  it('defaults straight to typing a random curated text', () => {
    render(<PracticePage />)

    expect(screen.getByLabelText('Typing input')).toBeInTheDocument()
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('offers a toggle to switch to a custom text at any time', async () => {
    render(<PracticePage />)
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: /practice custom text instead/i }),
    )

    expect(screen.getByLabelText(/your own text/i)).toBeInTheDocument()
  })

  it('lets the user practice their own pasted text', async () => {
    render(<PracticePage />)
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: /practice custom text instead/i }),
    )
    await user.type(screen.getByLabelText(/your own text/i), 'hi')
    await user.click(
      screen.getByRole('button', { name: /practice this text/i }),
    )

    await user.type(screen.getByLabelText('Typing input'), 'hi')

    expect(screen.getByText('wpm')).toBeInTheDocument()
  })

  it('can switch back to a random text from the custom input screen', async () => {
    render(<PracticePage />)
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: /practice custom text instead/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /use a random text instead/i }),
    )

    expect(screen.getByLabelText('Typing input')).toBeInTheDocument()
  })

  it('never shows any online save status - practice is fully offline', async () => {
    render(<PracticePage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'the curated text')

    await waitFor(() => expect(screen.getByText('wpm')).toBeInTheDocument())
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/flagged/i)).not.toBeInTheDocument()
  })

  it('"Next random text" is visible and works even before finishing a run', async () => {
    const requestNext = vi.fn()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'curated-1', content: 'ab' },
      loading: false,
      error: null,
      requestNext,
    })

    render(<PracticePage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /next random text/i }))

    expect(requestNext).toHaveBeenCalledOnce()
  })

  it('wires the tab+enter skip shortcut to the same next-text action', () => {
    const requestNext = vi.fn()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'curated-1', content: 'ab' },
      loading: false,
      error: null,
      requestNext,
    })

    render(<PracticePage />)
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'Tab' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(requestNext).toHaveBeenCalledOnce()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SoloPage } from './SoloPage'

const mocks = vi.hoisted(() => ({
  useRandomText: vi.fn(),
  submit: vi.fn(),
  useSubmitRun: vi.fn(),
}))

vi.mock('../typing/useRandomText', () => ({
  useRandomText: mocks.useRandomText,
}))

vi.mock('../typing/useSubmitRun', () => ({
  useSubmitRun: mocks.useSubmitRun,
}))

describe('SoloPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSubmitRun.mockReturnValue({
      submitting: false,
      result: null,
      error: null,
      submit: mocks.submit,
    })
  })

  it('shows a loading state while the text is being fetched', () => {
    mocks.useRandomText.mockReturnValue({
      text: null,
      loading: true,
      error: null,
      requestNext: vi.fn(),
    })

    render(<SoloPage />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an error when no text is available', () => {
    mocks.useRandomText.mockReturnValue({
      text: null,
      loading: false,
      error: 'No approved texts are available',
      requestNext: vi.fn(),
    })

    render(<SoloPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No approved texts are available',
    )
  })

  it('submits the keystroke log for the fetched text on finish', async () => {
    mocks.useRandomText.mockReturnValue({
      text: { id: 'text-1', content: 'abc' },
      loading: false,
      error: null,
      requestNext: vi.fn(),
    })

    render(<SoloPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'abc')

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce())
    const [textId, keystrokes] = mocks.submit.mock.calls[0]
    expect(textId).toBe('text-1')
    expect(keystrokes.map((k: { key: string }) => k.key)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('shows the save status once the result comes back', async () => {
    mocks.useRandomText.mockReturnValue({
      text: { id: 'text-1', content: 'ab' },
      loading: false,
      error: null,
      requestNext: vi.fn(),
    })
    mocks.useSubmitRun.mockReturnValue({
      submitting: false,
      result: { status: 'flagged' },
      error: null,
      submit: mocks.submit,
    })

    render(<SoloPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    await waitFor(() =>
      expect(screen.getByText(/flagged for review/i)).toBeInTheDocument(),
    )
  })

  it('"Next text" is visible and works even before finishing a run', async () => {
    const requestNext = vi.fn()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'a', content: 'ab' },
      loading: false,
      error: null,
      requestNext,
    })

    render(<SoloPage />)
    const user = userEvent.setup()

    // No typing yet - the button should already be there.
    await user.click(screen.getByRole('button', { name: /next text/i }))

    expect(requestNext).toHaveBeenCalledOnce()
  })

  it('wires the tab+enter skip shortcut to the same next-text action', () => {
    const requestNext = vi.fn()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'a', content: 'ab' },
      loading: false,
      error: null,
      requestNext,
    })

    render(<SoloPage />)
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'Tab' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(requestNext).toHaveBeenCalledOnce()
  })
})

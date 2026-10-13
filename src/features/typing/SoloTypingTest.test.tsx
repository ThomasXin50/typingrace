import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SoloTypingTest } from './SoloTypingTest'

const mocks = vi.hoisted(() => ({
  useRandomText: vi.fn(),
  submit: vi.fn(),
  useSubmitRun: vi.fn(),
}))

vi.mock('./useRandomText', () => ({
  useRandomText: mocks.useRandomText,
}))

vi.mock('./useSubmitRun', () => ({
  useSubmitRun: mocks.useSubmitRun,
}))

describe('SoloTypingTest', () => {
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

    render(<SoloTypingTest />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an error when no text is available', () => {
    mocks.useRandomText.mockReturnValue({
      text: null,
      loading: false,
      error: 'No approved texts are available',
      requestNext: vi.fn(),
    })

    render(<SoloTypingTest />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No approved texts are available',
    )
  })

  it('lets the user type the text, shows results, and submits the keystroke log', async () => {
    mocks.useRandomText.mockReturnValue({
      text: { id: 'text-1', content: 'abc' },
      loading: false,
      error: null,
      requestNext: vi.fn(),
    })

    render(<SoloTypingTest />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'abc')

    await waitFor(() => expect(screen.getByText('wpm')).toBeInTheDocument())
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('errors')).toBeInTheDocument()

    expect(mocks.submit).toHaveBeenCalledOnce()
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

    render(<SoloTypingTest />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    await waitFor(() =>
      expect(screen.getByText(/flagged for review/i)).toBeInTheDocument(),
    )
  })

  it('requests a new text when "Next text" is clicked', async () => {
    const requestNext = vi.fn()
    mocks.useRandomText.mockReturnValue({
      text: { id: 'a', content: 'ab' },
      loading: false,
      error: null,
      requestNext,
    })

    render(<SoloTypingTest />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')
    await waitFor(() => expect(screen.getByText('wpm')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /next text/i }))

    expect(requestNext).toHaveBeenCalledOnce()
  })
})

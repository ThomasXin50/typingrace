import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SoloTypingTest } from './SoloTypingTest'

const mocks = vi.hoisted(() => ({
  useRandomText: vi.fn(),
}))

vi.mock('./useRandomText', () => ({
  useRandomText: mocks.useRandomText,
}))

describe('SoloTypingTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('lets the user type the text and shows results on completion', async () => {
    mocks.useRandomText.mockReturnValue({
      text: { id: 'a', content: 'abc' },
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

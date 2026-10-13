import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TypingRun } from './TypingRun'

describe('TypingRun', () => {
  it('shows a start hint before typing begins, which disappears once it does', async () => {
    render(<TypingRun content="abc" />)

    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Typing input'), 'a')

    expect(screen.queryByText(/start typing to begin/i)).not.toBeInTheDocument()
  })

  it('renders the text and shows results once finished', async () => {
    render(<TypingRun content="abc" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'abc')

    expect(screen.getByText('wpm')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('calls onFinish exactly once with the keystroke log and stats', async () => {
    const onFinish = vi.fn()
    render(<TypingRun content="ab" onFinish={onFinish} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    expect(onFinish).toHaveBeenCalledOnce()
    const [keystrokes, stats] = onFinish.mock.calls[0]
    expect(keystrokes.map((k: { key: string }) => k.key)).toEqual(['a', 'b'])
    expect(stats.accuracy).toBe(100)
  })

  it('renders the footer only once the run is finished', async () => {
    render(<TypingRun content="ab" footer={<button>Next</button>} />)

    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Typing input'), 'ab')

    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('shows a "click to focus" overlay when the input loses focus mid-run, and clearing it refocuses', async () => {
    render(<TypingRun content="abcdef" />)
    const input = screen.getByLabelText('Typing input')
    const user = userEvent.setup()

    await user.type(input, 'ab')
    expect(screen.queryByText('Click to focus')).not.toBeInTheDocument()

    fireEvent.blur(input)
    expect(screen.getByText('Click to focus')).toBeInTheDocument()

    await user.click(screen.getByText('Click to focus'))
    expect(screen.queryByText('Click to focus')).not.toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('does not show the focus overlay once the run is finished', async () => {
    render(<TypingRun content="ab" />)
    const input = screen.getByLabelText('Typing input')
    const user = userEvent.setup()

    await user.type(input, 'ab')
    fireEvent.blur(input)

    expect(screen.queryByText('Click to focus')).not.toBeInTheDocument()
  })

  it('calls onSkip when Tab is held and Enter is pressed', () => {
    const onSkip = vi.fn()
    render(<TypingRun content="abc" onSkip={onSkip} />)
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'Tab' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('does not call onSkip for Enter alone, without Tab held', () => {
    const onSkip = vi.fn()
    render(<TypingRun content="abc" onSkip={onSkip} />)
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSkip).not.toHaveBeenCalled()
  })
})

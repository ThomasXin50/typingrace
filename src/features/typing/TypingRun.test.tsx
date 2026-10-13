import { render, screen } from '@testing-library/react'
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
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TypingRun } from './TypingRun'

describe('TypingRun', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('uses an injected now() for keystroke timestamps instead of the native event timestamp, when given', async () => {
    const onFinish = vi.fn()
    let tick = 10_000
    const now = () => {
      tick += 1000
      return tick
    }

    render(<TypingRun content="ab" onFinish={onFinish} now={now} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    const [keystrokes] = onFinish.mock.calls[0]
    expect(keystrokes.map((k: { timestamp: number }) => k.timestamp)).toEqual([
      11000, 12000,
    ])
  })

  it('shows a live ticking elapsed-time clock immediately once startTimestamp is given, instead of waiting for the first keystroke', () => {
    vi.useFakeTimers()
    let tick = 10_000
    const now = () => tick

    render(<TypingRun content="abc" now={now} startTimestamp={10_000} />)

    expect(screen.queryByText(/start typing to begin/i)).not.toBeInTheDocument()
    expect(screen.getByText('0:00')).toBeInTheDocument()

    tick = 13_000
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('0:03')).toBeInTheDocument()
  })

  it('stops the live clock once finished', async () => {
    const now = () => Date.now()

    render(<TypingRun content="ab" now={now} startTimestamp={Date.now()} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    expect(screen.getByText('wpm')).toBeInTheDocument()
    expect(screen.queryByText(/^\d:\d\d$/)).not.toBeInTheDocument()
  })

  it('forwards startTimestamp into the typing engine for duration calculation', async () => {
    const onFinish = vi.fn()
    // Explicitly controlled per keystroke (not auto-incrementing on every
    // call) so this stays correct regardless of other, unrelated calls to
    // now() the component also makes (e.g. the live race-clock display).
    let tick = 0
    const now = () => tick

    render(
      <TypingRun
        content="ab"
        onFinish={onFinish}
        now={now}
        startTimestamp={0}
      />,
    )
    const user = userEvent.setup()
    const input = screen.getByLabelText('Typing input')

    tick = 30_000
    await user.type(input, 'a')
    tick = 60_000
    await user.type(input, 'b')

    const [, stats] = onFinish.mock.calls[0]
    // Both keystrokes land at +30s/+60s; duration from startTimestamp=0 to
    // the finishing keystroke (60s) is 60000ms, not 30000ms (which it would
    // be if measured from the first keystroke instead).
    expect(stats.durationMs).toBe(60_000)
  })

  it('an externally-owned tabHeldRef keeps "Tab held" true across a skip remount, so repeated Enters keep working without re-pressing Tab', () => {
    const onSkip = vi.fn()
    const tabHeldRef = { current: false }
    const { rerender } = render(
      <TypingRun
        key="run-1"
        content="abc"
        onSkip={onSkip}
        tabHeldRef={tabHeldRef}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Typing input'), { key: 'Tab' })
    fireEvent.keyDown(screen.getByLabelText('Typing input'), { key: 'Enter' })
    expect(onSkip).toHaveBeenCalledOnce()

    // Simulate the parent remounting TypingRun in response to onSkip (as
    // SoloPage/PracticePage do, keyed by selectionKey/runKey) while the user
    // is still physically holding Tab down - the same ref object is passed
    // to the new instance.
    rerender(
      <TypingRun
        key="run-2"
        content="def"
        onSkip={onSkip}
        tabHeldRef={tabHeldRef}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Typing input'), { key: 'Enter' })

    expect(onSkip).toHaveBeenCalledTimes(2)
  })
})

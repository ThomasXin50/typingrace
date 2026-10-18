import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RunsTrendChart } from './RunsTrendChart'
import type { RecentRun } from './useRecentRuns'

function run(overrides: Partial<RecentRun>): RecentRun {
  return {
    id: 'run',
    createdAt: '2026-01-01T12:00:00.000Z',
    wpm: 80,
    rawWpm: 85,
    accuracy: 95,
    errorCount: 2,
    durationMs: 10000,
    validationStatus: 'verified',
    ...overrides,
  }
}

describe('RunsTrendChart', () => {
  it('renders nothing with fewer than 3 verified runs - not enough signal for a trend', () => {
    const { container } = render(
      <RunsTrendChart
        runs={[
          run({ id: '1', wpm: 80 }),
          run({ id: '2', wpm: 90, validationStatus: 'flagged' }),
        ]}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('excludes flagged/rejected runs from the 3-point threshold, not just from the line', () => {
    const { container } = render(
      <RunsTrendChart
        runs={[
          run({ id: '1', validationStatus: 'verified' }),
          run({ id: '2', validationStatus: 'flagged' }),
          run({ id: '3', validationStatus: 'rejected' }),
        ]}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible chart, oldest to newest, defaulting to net (error-adjusted) wpm', () => {
    const runs = [
      run({
        id: '3',
        createdAt: '2026-01-03T12:00:00.000Z',
        wpm: 90,
        rawWpm: 100,
      }),
      run({
        id: '2',
        createdAt: '2026-01-02T12:00:00.000Z',
        wpm: 85,
        rawWpm: 90,
      }),
      run({
        id: '1',
        createdAt: '2026-01-01T12:00:00.000Z',
        wpm: 80,
        rawWpm: 80,
      }),
    ]

    render(<RunsTrendChart runs={runs} />)

    expect(screen.getByRole('img', { name: /wpm trend/i })).toBeInTheDocument()
    // The sr-only summary is built oldest-first (run 1, then 2, then 3),
    // the reverse of how the hook returns them (most recent first).
    expect(
      screen.getByText(/80 wpm on Jan 1.*85 wpm on Jan 2.*90 wpm on Jan 3/),
    ).toBeInTheDocument()
  })

  it('skips non-verified runs entirely when building the series', () => {
    const runs = [
      run({ id: '4', createdAt: '2026-01-04T12:00:00.000Z', wpm: 999 }),
      run({
        id: '3',
        createdAt: '2026-01-03T12:00:00.000Z',
        wpm: 90,
        validationStatus: 'flagged',
      }),
      run({ id: '2', createdAt: '2026-01-02T12:00:00.000Z', wpm: 85 }),
      run({ id: '1', createdAt: '2026-01-01T12:00:00.000Z', wpm: 80 }),
    ]
    runs[0].validationStatus = 'verified'

    render(<RunsTrendChart runs={runs} />)

    expect(screen.queryByText(/90 wpm/)).not.toBeInTheDocument()
    expect(screen.getByText(/999 wpm on Jan 4/)).toBeInTheDocument()
  })

  it('does not throw when hovered before layout (zero-size rect)', () => {
    const runs = [
      run({ id: '1', createdAt: '2026-01-01T12:00:00.000Z' }),
      run({ id: '2', createdAt: '2026-01-02T12:00:00.000Z' }),
      run({ id: '3', createdAt: '2026-01-03T12:00:00.000Z' }),
    ]

    render(<RunsTrendChart runs={runs} />)
    const svg = screen.getByRole('img', { name: /wpm trend/i })

    expect(() => fireEvent.pointerMove(svg, { clientX: 403 })).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('toggles to raw wpm on click, updating the data summary, and back to net on a second click', async () => {
    const runs = [
      run({
        id: '1',
        createdAt: '2026-01-01T12:00:00.000Z',
        wpm: 80,
        rawWpm: 90,
      }),
      run({ id: '2', createdAt: '2026-01-02T12:00:00.000Z' }),
      run({ id: '3', createdAt: '2026-01-03T12:00:00.000Z' }),
    ]

    render(<RunsTrendChart runs={runs} />)
    const user = userEvent.setup()

    expect(screen.getByText(/80 wpm on Jan 1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /raw wpm/i }))

    expect(screen.getByText(/90 wpm on Jan 1/)).toBeInTheDocument()
    expect(screen.queryByText(/80 wpm on Jan 1/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /net wpm/i }))

    expect(screen.getByText(/80 wpm on Jan 1/)).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WpmChart } from './WpmChart'

describe('WpmChart', () => {
  it('renders nothing when there are no points (run too short to chart)', () => {
    const { container } = render(<WpmChart points={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible chart with a screen-reader data summary', () => {
    const points = [
      { timeSec: 1, wpm: 80 },
      { timeSec: 2, wpm: 95 },
      { timeSec: 3, wpm: 90 },
    ]

    render(<WpmChart points={points} />)

    expect(
      screen.getByRole('img', { name: /wpm over time/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/80 wpm at 1s.*95 wpm at 2s.*90 wpm at 3s/),
    ).toBeInTheDocument()
  })

  it('does not throw when hovered before layout (zero-size rect)', () => {
    const points = [
      { timeSec: 1, wpm: 80 },
      { timeSec: 2, wpm: 95 },
      { timeSec: 3, wpm: 90 },
    ]

    render(<WpmChart points={points} />)
    const svg = screen.getByRole('img', { name: /wpm over time/i })

    // jsdom's unlayout'd elements report a zero-size rect; the handler
    // should no-op rather than show a nonsensical index-0 tooltip.
    expect(() => fireEvent.pointerMove(svg, { clientX: 403 })).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

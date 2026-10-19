import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WpmChart } from './WpmChart'

describe('WpmChart', () => {
  it('renders nothing when there are no points (run too short to chart)', () => {
    const { container } = render(<WpmChart points={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible chart with a screen-reader data summary, defaulting to net (error-adjusted) wpm', () => {
    const points = [
      { timeSec: 1, wpm: 80, rawWpm: 85 },
      { timeSec: 2, wpm: 95, rawWpm: 95 },
      { timeSec: 3, wpm: 90, rawWpm: 100 },
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
      { timeSec: 1, wpm: 80, rawWpm: 80 },
      { timeSec: 2, wpm: 95, rawWpm: 95 },
      { timeSec: 3, wpm: 90, rawWpm: 90 },
    ]

    render(<WpmChart points={points} />)
    const svg = screen.getByRole('img', { name: /wpm over time/i })

    // jsdom's unlayout'd elements report a zero-size rect; the handler
    // should no-op rather than show a nonsensical index-0 tooltip.
    expect(() => fireEvent.pointerMove(svg, { clientX: 403 })).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sizes the draw-in animation to the real path length instead of a fixed budget, so a long zigzagging run still draws fully', () => {
    const points = [
      { timeSec: 1, wpm: 80, rawWpm: 80 },
      { timeSec: 2, wpm: 95, rawWpm: 95 },
    ]

    const { rerender } = render(<WpmChart points={points} />)
    const path = document.querySelector<SVGPathElement>('.wpm-chart__line')

    // jsdom doesn't implement SVGGeometryElement.getTotalLength, so patch
    // it onto the rendered node directly (as a real browser's would be),
    // simulating a path far longer than any fixed stroke-dasharray budget
    // (e.g. a long run with lots of wpm swings), then trigger the effect
    // that re-measures it by changing the path's geometry.
    expect(path).not.toBeNull()
    Object.defineProperty(path, 'getTotalLength', {
      value: () => 4321,
      configurable: true,
    })

    rerender(
      <WpmChart points={[...points, { timeSec: 3, wpm: 60, rawWpm: 60 }]} />,
    )

    expect(path?.style.getPropertyValue('--wpm-chart-path-length')).toBe('4321')
  })

  it('falls back to the CSS default budget without crashing when path-length measurement is unavailable (e.g. jsdom)', () => {
    const points = [
      { timeSec: 1, wpm: 80, rawWpm: 80 },
      { timeSec: 2, wpm: 95, rawWpm: 95 },
    ]

    render(<WpmChart points={points} />)

    const path = document.querySelector<SVGPathElement>('.wpm-chart__line')
    expect(path?.style.getPropertyValue('--wpm-chart-path-length')).toBe('')
  })

  it('toggles to raw wpm on click, updating the data summary, and back to net on a second click', async () => {
    const points = [
      { timeSec: 1, wpm: 80, rawWpm: 90 },
      { timeSec: 2, wpm: 95, rawWpm: 95 },
    ]

    render(<WpmChart points={points} />)
    const user = userEvent.setup()

    expect(screen.getByText(/80 wpm at 1s/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /raw wpm/i }))

    expect(screen.getByText(/90 wpm at 1s/)).toBeInTheDocument()
    expect(screen.queryByText(/80 wpm at 1s/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /net wpm/i }))

    expect(screen.getByText(/80 wpm at 1s/)).toBeInTheDocument()
  })
})

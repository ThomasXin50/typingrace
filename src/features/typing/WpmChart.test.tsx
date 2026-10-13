import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WpmChart } from './WpmChart'

describe('WpmChart', () => {
  it('renders nothing when there are no points (run too short to chart)', () => {
    const { container } = render(<WpmChart points={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible chart with a table-view twin', async () => {
    const points = [
      { timeSec: 1, wpm: 80 },
      { timeSec: 2, wpm: 95 },
      { timeSec: 3, wpm: 90 },
    ]

    render(<WpmChart points={points} />)

    expect(
      screen.getByRole('img', { name: /wpm over time/i }),
    ).toBeInTheDocument()

    // The table view is the accessibility twin - not rendered until asked for.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /view as table/i }))

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
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
    expect(screen.queryByText(/wpm at \d+s/)).not.toBeInTheDocument()
  })
})

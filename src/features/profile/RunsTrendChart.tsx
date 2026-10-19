import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RecentRun } from './useRecentRuns'
import {
  HEIGHT,
  INNER_HEIGHT,
  PAD_LEFT,
  PAD_RIGHT,
  PAD_TOP,
  WIDTH,
  nearestIndexForClientX,
  niceMax,
  niceMin,
  xForIndex,
  yForWpm,
} from './runsTrendChartMath'
import './runsTrendChart.css'

interface RunsTrendChartProps {
  runs: RecentRun[]
}

const MIN_POINTS = 3

export function RunsTrendChart({ runs }: RunsTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState<number | null>(null)
  const titleId = useId()
  const descId = useId()

  // Oldest to newest, left to right - a "progress over time" read - and
  // verified only, since flagged/rejected wpm values aren't trustworthy
  // signal to chart alongside real ones.
  const verified = runs
    .filter((r) => r.validationStatus === 'verified')
    .slice()
    .reverse()

  const displayed = verified.map((r) => ({
    createdAt: r.createdAt,
    wpm: showRaw ? r.rawWpm : r.wpm,
  }))

  const series = displayed.map((p, i) => ({ index: i, wpm: p.wpm }))
  const maxIndex = Math.max(0, series.length - 1)
  const wpmValues = series.map((p) => p.wpm)
  const minWpm = series.length > 0 ? niceMin(Math.min(...wpmValues)) : 0
  const maxWpm = series.length > 0 ? niceMax(Math.max(...wpmValues)) : 20

  const x = (index: number) => xForIndex(index, maxIndex)
  const y = (wpm: number) => yForWpm(wpm, minWpm, maxWpm)

  const linePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.index)},${y(p.wpm)}`)
    .join(' ')

  // Same reasoning as WpmChart: measuring the real path length keeps the
  // draw-in animation correct for any number of points, instead of
  // stopping partway through once it exceeds a fixed budget.
  useLayoutEffect(() => {
    if (typeof pathRef.current?.getTotalLength === 'function') {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [linePath])

  if (displayed.length < MIN_POINTS) return null

  const last = displayed[displayed.length - 1]

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setHoverIndex(
      nearestIndexForClientX(
        e.clientX,
        rect.left,
        rect.width,
        series,
        maxIndex,
      ),
    )
  }

  const hovered = hoverIndex !== null ? displayed[hoverIndex] : null
  const hoveredPoint = hoverIndex !== null ? series[hoverIndex] : null

  return (
    <div className="runs-trend-chart">
      <div className="runs-trend-chart__header">
        <h3 className="runs-trend-chart__title" id={titleId}>
          wpm trend
        </h3>
        <button
          type="button"
          className="runs-trend-chart__toggle"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Net wpm' : 'Raw wpm'}
        </button>
      </div>

      <svg
        ref={svgRef}
        className="runs-trend-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[0, 0.5, 1].map((frac) => (
          <line
            key={frac}
            className="runs-trend-chart__gridline"
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + INNER_HEIGHT * (1 - frac)}
            y2={PAD_TOP + INNER_HEIGHT * (1 - frac)}
          />
        ))}

        {[0, 0.5, 1].map((frac) => (
          <text
            key={frac}
            className="runs-trend-chart__tick-label"
            x={PAD_LEFT - 8}
            y={PAD_TOP + INNER_HEIGHT * (1 - frac)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {Math.round(minWpm + (maxWpm - minWpm) * frac)}
          </text>
        ))}

        <path
          ref={pathRef}
          className="runs-trend-chart__line"
          d={linePath}
          style={
            pathLength !== null
              ? ({
                  '--runs-trend-chart-path-length': pathLength,
                } as React.CSSProperties)
              : undefined
          }
        />

        <circle
          className="runs-trend-chart__end-dot"
          cx={x(maxIndex)}
          cy={y(last.wpm)}
          r={5}
        />

        {hovered && hoveredPoint && (
          <>
            <line
              className="runs-trend-chart__crosshair"
              x1={x(hoveredPoint.index)}
              x2={x(hoveredPoint.index)}
              y1={PAD_TOP}
              y2={PAD_TOP + INNER_HEIGHT}
            />
            <circle
              className="runs-trend-chart__hover-dot"
              cx={x(hoveredPoint.index)}
              cy={y(hoveredPoint.wpm)}
              r={5}
            />
          </>
        )}
      </svg>

      <span className="runs-trend-chart__sr-only" id={descId}>
        {displayed
          .map((p) => `${Math.round(p.wpm)} wpm on ${formatDate(p.createdAt)}`)
          .join(', ')}
      </span>

      {hovered && (
        <p className="runs-trend-chart__tooltip" role="status">
          {Math.round(hovered.wpm)} wpm on {formatDate(hovered.createdAt)}
        </p>
      )}
    </div>
  )
}

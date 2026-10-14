import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { WpmPoint } from './wpmSeries'
import {
  HEIGHT,
  INNER_HEIGHT,
  PAD_LEFT,
  PAD_RIGHT,
  PAD_TOP,
  WIDTH,
  nearestIndexForClientX,
  niceMax,
  withOrigin,
  xForTime,
  yForWpm,
} from './wpmChartMath'
import './wpmChart.css'

interface WpmChartProps {
  points: WpmPoint[]
}

export function WpmChart({ points }: WpmChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState<number | null>(null)
  const titleId = useId()
  const descId = useId()

  // Net (error-adjusted) wpm is the default, matching the headline stat -
  // raw (every keystroke, including uncorrected typos) is opt-in.
  const displayed = points.map((p) => ({
    timeSec: p.timeSec,
    wpm: showRaw ? p.rawWpm : p.wpm,
  }))

  const series = displayed.length > 0 ? withOrigin(displayed) : []
  const maxTime = series.length > 0 ? series[series.length - 1].timeSec : 0
  const maxWpm = niceMax(Math.max(0, ...series.map((p) => p.wpm)))

  const x = (timeSec: number) => xForTime(timeSec, maxTime)
  const y = (wpm: number) => yForWpm(wpm, maxWpm)

  const linePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.timeSec)},${y(p.wpm)}`)
    .join(' ')

  // A static stroke-dasharray breaks the draw-in animation once a run's
  // path (which zigzags with every wpm swing) grows longer than that fixed
  // budget - the line then stops partway through and never fully draws.
  // Measuring the real length keeps it correct for any run length. jsdom
  // doesn't implement getTotalLength, so this is a no-op in tests (the CSS
  // fallback value applies instead).
  useLayoutEffect(() => {
    if (typeof pathRef.current?.getTotalLength === 'function') {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [linePath])

  if (points.length === 0) return null

  const last = displayed[displayed.length - 1]

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setHoverIndex(
      nearestIndexForClientX(e.clientX, rect.left, rect.width, series, maxTime),
    )
  }

  const hovered = hoverIndex !== null ? series[hoverIndex] : null

  return (
    <div className="wpm-chart">
      <div className="wpm-chart__header">
        <h3 className="wpm-chart__title" id={titleId}>
          wpm over time
        </h3>
        <button
          type="button"
          className="wpm-chart__toggle"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Net wpm' : 'Raw wpm'}
        </button>
      </div>

      <svg
        ref={svgRef}
        className="wpm-chart__svg"
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
            className="wpm-chart__gridline"
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + INNER_HEIGHT * (1 - frac)}
            y2={PAD_TOP + INNER_HEIGHT * (1 - frac)}
          />
        ))}

        {[0, 0.5, 1].map((frac) => (
          <text
            key={frac}
            className="wpm-chart__tick-label"
            x={PAD_LEFT - 8}
            y={PAD_TOP + INNER_HEIGHT * (1 - frac)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {Math.round(maxWpm * frac)}
          </text>
        ))}

        <path
          ref={pathRef}
          className="wpm-chart__line"
          d={linePath}
          style={
            pathLength !== null
              ? ({
                  '--wpm-chart-path-length': pathLength,
                } as React.CSSProperties)
              : undefined
          }
        />

        <circle
          className="wpm-chart__end-dot"
          cx={x(last.timeSec)}
          cy={y(last.wpm)}
          r={5}
        />

        {hovered && (
          <>
            <line
              className="wpm-chart__crosshair"
              x1={x(hovered.timeSec)}
              x2={x(hovered.timeSec)}
              y1={PAD_TOP}
              y2={PAD_TOP + INNER_HEIGHT}
            />
            <circle
              className="wpm-chart__hover-dot"
              cx={x(hovered.timeSec)}
              cy={y(hovered.wpm)}
              r={5}
            />
          </>
        )}
      </svg>

      <span className="wpm-chart__sr-only" id={descId}>
        {displayed
          .map((p) => `${Math.round(p.wpm)} wpm at ${p.timeSec}s`)
          .join(', ')}
      </span>

      {hovered && (
        <p className="wpm-chart__tooltip" role="status">
          {Math.round(hovered.wpm)} wpm at {hovered.timeSec}s
        </p>
      )}
    </div>
  )
}

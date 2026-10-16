import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAutoScrollText } from './useAutoScrollText'
import {
  useTypingEngine,
  type Keystroke,
  type TypingStats,
} from './useTypingEngine'
import { WpmChart } from './WpmChart'
import { computeWpmSeries } from './wpmSeries'
import './typing.css'

const RACE_CLOCK_TICK_MS = 200

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface TypingRunProps {
  content: string
  onFinish?: (keystrokes: Keystroke[], stats: TypingStats) => void
  onSkip?: () => void
  /** Fired on every keystroke (correct or not - a struggling-but-still-
   * typing player still counts as active) with the current progress
   * fraction through the text, 0-1. Never fired before the first
   * keystroke. Intended for broadcasting live race progress; omit for
   * solo/practice. */
  onProgress?: (progressPct: number) => void
  footer?: ReactNode
  /** Tracks whether Tab is currently held, for the tab+enter skip shortcut.
   * Skipping remounts TypingRun with a fresh instance, which would otherwise
   * lose this mid-hold - pass a ref owned by the parent page (which doesn't
   * remount) so holding Tab and tapping Enter repeatedly keeps working across
   * skips. Defaults to an internal ref for standalone use. */
  tabHeldRef?: { current: boolean }
  /** Timestamp source for keystrokes. Defaults to the native event's own
   * timeStamp (performance.now()-relative) for solo/practice. A race passes
   * `() => Date.now()` instead, so timestamps are directly comparable to
   * the round's wall-clock startTimestamp. */
  now?: () => number
  /** Forwarded to useTypingEngine - see its startTimestamp option. Only
   * meaningful alongside a wall-clock `now`. */
  startTimestamp?: number
}

export function TypingRun({
  content,
  onFinish,
  onSkip,
  onProgress,
  footer,
  tabHeldRef: externalTabHeldRef,
  now,
  startTimestamp,
}: TypingRunProps) {
  const engine = useTypingEngine(content, { startTimestamp })
  const { viewportRef, textRef, clipped, heightPx, offsetPx } =
    useAutoScrollText(engine.typed.length)
  const inputRef = useRef<HTMLInputElement>(null)
  const internalTabHeldRef = useRef(false)
  const tabHeldRef = externalTabHeldRef ?? internalTabHeldRef
  const [focused, setFocused] = useState(false)
  // A race's clock starts the instant this mounts (right as the
  // synchronized countdown elapses), not on the player's first keystroke -
  // the lazy initializer captures that immediately; the interval keeps it
  // ticking so it's visibly live rather than looking stalled while idle.
  const [elapsedMs, setElapsedMs] = useState(() =>
    startTimestamp !== undefined
      ? (now ? now() : Date.now()) - startTimestamp
      : 0,
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (startTimestamp === undefined || engine.status === 'finished') return

    const interval = setInterval(() => {
      setElapsedMs((now ? now() : Date.now()) - startTimestamp)
    }, RACE_CLOCK_TICK_MS)

    return () => clearInterval(interval)
  }, [startTimestamp, engine.status, now])

  useEffect(() => {
    if (engine.status === 'finished' && engine.stats) {
      onFinish?.(engine.keystrokes, engine.stats)
    }
    // engine.status flips to 'finished' exactly once per run (handleKeyDown
    // locks out further events after), so only that transition matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  useEffect(() => {
    if (engine.keystrokes.length === 0) return
    onProgress?.(engine.typed.length / content.length)
    // Fires once per keystroke, not on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.keystrokes])

  const wpmSeries = useMemo(
    () =>
      engine.status === 'finished'
        ? computeWpmSeries(content, engine.keystrokes, startTimestamp)
        : [],
    [engine.status, content, engine.keystrokes, startTimestamp],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      tabHeldRef.current = true
      return
    }
    if (e.key === 'Enter' && tabHeldRef.current) {
      e.preventDefault()
      onSkip?.()
      return
    }
    if (e.key !== 'Backspace' && e.key.length !== 1) return
    e.preventDefault()
    engine.handleKeyDown({
      key: e.key,
      timestamp: now ? now() : e.nativeEvent.timeStamp,
      trusted: e.nativeEvent.isTrusted,
    })
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') tabHeldRef.current = false
  }

  const showOverlay = !focused && engine.status !== 'finished'

  return (
    <div className="typing-test">
      <div className="typing-hint-slot">
        {startTimestamp !== undefined
          ? engine.status !== 'finished' &&
            !showOverlay && (
              <p className="typing-status typing-status--hint typing-status--clock">
                {formatElapsed(elapsedMs)}
              </p>
            )
          : engine.status === 'idle' &&
            !showOverlay && (
              <p className="typing-status typing-status--hint">
                Start typing to begin
              </p>
            )}
      </div>

      <div
        className={
          showOverlay
            ? 'typing-text-wrap typing-text-wrap--blurred'
            : 'typing-text-wrap'
        }
        onClick={() => inputRef.current?.focus()}
      >
        <div
          ref={viewportRef}
          className={
            clipped
              ? 'typing-text-viewport typing-text-viewport--clipped'
              : 'typing-text-viewport'
          }
          style={clipped ? { height: heightPx } : undefined}
        >
          <div
            ref={textRef}
            className="typing-text"
            style={
              clipped ? { transform: `translateY(-${offsetPx}px)` } : undefined
            }
          >
            {content.split('').map((char, i) => (
              <span
                key={i}
                className={`typing-char typing-char--${engine.charStatuses[i]}`}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
        {showOverlay && (
          <button
            type="button"
            className="typing-overlay"
            onClick={() => inputRef.current?.focus()}
          >
            Click to focus
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        className="typing-input"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={engine.status === 'finished'}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Typing input"
      />

      {engine.status === 'finished' && engine.stats && (
        <>
          <div className="typing-results typing-results--enter">
            <div className="stat-tile stat-tile--primary">
              <span className="stat-tile__value">
                {Math.round(engine.stats.wpm)}
              </span>
              <span className="stat-tile__label">wpm</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">
                {Math.round(engine.stats.accuracy)}%
              </span>
              <span className="stat-tile__label">accuracy</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">
                {Math.round(engine.stats.rawWpm)}
              </span>
              <span className="stat-tile__label">raw wpm</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">
                {engine.stats.errorCount}
              </span>
              <span className="stat-tile__label">errors</span>
            </div>
          </div>
          <WpmChart points={wpmSeries} />
          {footer}
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  useTypingEngine,
  type Keystroke,
  type TypingStats,
} from './useTypingEngine'
import { WpmChart } from './WpmChart'
import { computeWpmSeries } from './wpmSeries'
import './typing.css'

interface TypingRunProps {
  content: string
  onFinish?: (keystrokes: Keystroke[], stats: TypingStats) => void
  onSkip?: () => void
  footer?: ReactNode
  /** Tracks whether Tab is currently held, for the tab+enter skip shortcut.
   * Skipping remounts TypingRun with a fresh instance, which would otherwise
   * lose this mid-hold - pass a ref owned by the parent page (which doesn't
   * remount) so holding Tab and tapping Enter repeatedly keeps working across
   * skips. Defaults to an internal ref for standalone use. */
  tabHeldRef?: { current: boolean }
}

export function TypingRun({
  content,
  onFinish,
  onSkip,
  footer,
  tabHeldRef: externalTabHeldRef,
}: TypingRunProps) {
  const engine = useTypingEngine(content)
  const inputRef = useRef<HTMLInputElement>(null)
  const internalTabHeldRef = useRef(false)
  const tabHeldRef = externalTabHeldRef ?? internalTabHeldRef
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (engine.status === 'finished' && engine.stats) {
      onFinish?.(engine.keystrokes, engine.stats)
    }
    // engine.status flips to 'finished' exactly once per run (handleKeyDown
    // locks out further events after), so only that transition matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  const wpmSeries = useMemo(
    () =>
      engine.status === 'finished'
        ? computeWpmSeries(content, engine.keystrokes)
        : [],
    [engine.status, content, engine.keystrokes],
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
      timestamp: e.nativeEvent.timeStamp,
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
        {engine.status === 'idle' && !showOverlay && (
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
        <div className="typing-text">
          {content.split('').map((char, i) => (
            <span
              key={i}
              className={`typing-char typing-char--${engine.charStatuses[i]}`}
            >
              {char}
            </span>
          ))}
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

import { useEffect, useRef, type ReactNode } from 'react'
import {
  useTypingEngine,
  type Keystroke,
  type TypingStats,
} from './useTypingEngine'
import './typing.css'

interface TypingRunProps {
  content: string
  onFinish?: (keystrokes: Keystroke[], stats: TypingStats) => void
  footer?: ReactNode
}

export function TypingRun({ content, onFinish, footer }: TypingRunProps) {
  const engine = useTypingEngine(content)
  const inputRef = useRef<HTMLInputElement>(null)

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace' && e.key.length !== 1) return
    e.preventDefault()
    engine.handleKeyDown({
      key: e.key,
      timestamp: e.nativeEvent.timeStamp,
      trusted: e.nativeEvent.isTrusted,
    })
  }

  return (
    <div className="typing-test">
      {engine.status === 'idle' && (
        <p className="typing-status typing-status--hint">
          Start typing to begin
        </p>
      )}

      <div className="typing-text" onClick={() => inputRef.current?.focus()}>
        {content.split('').map((char, i) => (
          <span
            key={i}
            className={`typing-char typing-char--${engine.charStatuses[i]}`}
          >
            {char}
          </span>
        ))}
      </div>

      <input
        ref={inputRef}
        className="typing-input"
        onKeyDown={handleKeyDown}
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
          <div className="typing-results">
            <div className="typing-stat typing-stat--primary">
              <span className="typing-stat__value">
                {Math.round(engine.stats.wpm)}
              </span>
              <span className="typing-stat__label">wpm</span>
            </div>
            <div className="typing-stat">
              <span className="typing-stat__value">
                {Math.round(engine.stats.accuracy)}%
              </span>
              <span className="typing-stat__label">accuracy</span>
            </div>
            <div className="typing-stat">
              <span className="typing-stat__value">
                {Math.round(engine.stats.rawWpm)}
              </span>
              <span className="typing-stat__label">raw wpm</span>
            </div>
            <div className="typing-stat">
              <span className="typing-stat__value">
                {engine.stats.errorCount}
              </span>
              <span className="typing-stat__label">errors</span>
            </div>
          </div>
          {footer}
        </>
      )}
    </div>
  )
}

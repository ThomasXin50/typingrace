import { useEffect, useRef } from 'react'
import { useRandomText } from './useRandomText'
import { useSubmitRun } from './useSubmitRun'
import { useTypingEngine } from './useTypingEngine'
import './typing.css'

export function SoloTypingTest() {
  const { text, loading, error, requestNext } = useRandomText()
  const content = text?.content ?? ''
  const engine = useTypingEngine(content)
  const submitRun = useSubmitRun()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    engine.reset()
    inputRef.current?.focus()
    // Resets only when the fetched text itself changes, not on every
    // engine re-render (engine is a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    if (engine.status === 'finished' && text) {
      submitRun.submit(text.id, engine.keystrokes)
    }
    // engine.status flips to 'finished' exactly once per run (handleKeyDown
    // locks out further events after), so only that transition matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  if (loading) {
    return <p className="typing-status">Loading a text to type…</p>
  }

  if (error) {
    return (
      <p className="typing-status" role="alert">
        {error}
      </p>
    )
  }

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
          <button type="button" className="typing-next" onClick={requestNext}>
            Next text
          </button>
        </div>
      )}

      {engine.status === 'finished' && (
        <p className="typing-save-status">
          {submitRun.submitting && 'Saving…'}
          {submitRun.error && `Not saved: ${submitRun.error}`}
          {submitRun.result?.status === 'verified' && 'Saved to your history.'}
          {submitRun.result?.status === 'flagged' &&
            "Saved, but flagged for review — won't count on the leaderboard yet."}
          {submitRun.result?.status === 'rejected' &&
            'Not counted — this run looked automated.'}
        </p>
      )}
    </div>
  )
}

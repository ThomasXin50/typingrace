import { useState } from 'react'
import { TypingRun } from '../typing/TypingRun'
import { useRandomText } from '../typing/useRandomText'
import './practice.css'

export function PracticePage() {
  const { text, loading, error, requestNext } = useRandomText()
  const [customText, setCustomText] = useState('')
  const [enteringCustom, setEnteringCustom] = useState(false)
  const [override, setOverride] = useState<string | null>(null)

  if (loading) {
    return <p className="page-status">Loading a text to type…</p>
  }

  if (error) {
    return (
      <p className="page-status" role="alert">
        {error}
      </p>
    )
  }

  if (enteringCustom) {
    return (
      <div className="practice-chooser">
        <button
          type="button"
          className="practice-link"
          onClick={() => setEnteringCustom(false)}
        >
          Use a random text instead
        </button>
        <label htmlFor="custom-text" className="practice-chooser__label">
          Paste your own text
        </label>
        <textarea
          id="custom-text"
          className="practice-chooser__textarea"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          rows={4}
        />
        <button
          type="button"
          className="btn"
          disabled={customText.trim().length === 0}
          onClick={() => {
            setOverride(customText.trim())
            setEnteringCustom(false)
          }}
        >
          Practice this text
        </button>
      </div>
    )
  }

  const content = override ?? text!.content

  function handleNext() {
    setOverride(null)
    requestNext()
  }

  return (
    <div className="practice-run">
      <button
        type="button"
        className="practice-link"
        onClick={() => setEnteringCustom(true)}
      >
        Practice custom text instead
      </button>
      <TypingRun key={content} content={content} onSkip={handleNext} />
      <button type="button" className="btn" onClick={handleNext}>
        Next random text <span className="btn__shortcut">(tab + enter)</span>
      </button>
    </div>
  )
}

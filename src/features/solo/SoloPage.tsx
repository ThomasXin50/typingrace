import { useRef } from 'react'
import { TypingRun } from '../typing/TypingRun'
import { useRandomText } from '../typing/useRandomText'
import { useSubmitRun } from '../typing/useSubmitRun'
import type { Keystroke } from '../typing/useTypingEngine'
import './solo.css'

export function SoloPage() {
  const { text, loading, error, selectionKey, requestNext } = useRandomText()
  const submitRun = useSubmitRun()
  // Owned here (not inside TypingRun) so holding Tab survives the remount
  // that happens on every skip - see TypingRun's tabHeldRef prop.
  const tabHeldRef = useRef(false)

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

  function handleFinish(keystrokes: Keystroke[]) {
    if (text) submitRun.submit(text.id, keystrokes)
  }

  return (
    <div className="solo-run">
      <TypingRun
        key={selectionKey}
        content={text!.content}
        onFinish={handleFinish}
        onSkip={requestNext}
        tabHeldRef={tabHeldRef}
        footer={
          <p className="typing-save-status">
            {submitRun.submitting && 'Saving…'}
            {submitRun.error && `Not saved: ${submitRun.error}`}
            {submitRun.result?.status === 'verified' &&
              'Saved to your history.'}
            {submitRun.result?.status === 'flagged' &&
              "Saved, but flagged for review — won't count on the leaderboard yet."}
            {submitRun.result?.status === 'rejected' &&
              'Not counted — this run looked automated.'}
          </p>
        }
      />
      <button type="button" className="btn" onClick={requestNext}>
        Next text <span className="btn__shortcut">(tab + enter)</span>
      </button>
    </div>
  )
}

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CAP_HEIGHT,
  KEY_SIZE,
  PRESS_SEQUENCE,
  buildKeyLayout,
} from './heroKeyboardLayout'
import './heroKeyboard.css'

const STEP_MS = 260
const SCENE_WIDTH = 640
const SCENE_HEIGHT = 320

const keys = buildKeyLayout()

/**
 * Purely decorative homepage banner - a 3D mechanical keyboard, viewed
 * from a low bottom-left angle, pressing out "typingtest" on a loop.
 * aria-hidden throughout: it carries no information a screen reader
 * needs that the page's actual heading/links don't already say.
 */
export function HeroKeyboard() {
  const [step, setStep] = useState(0)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const interval = setInterval(() => {
      setStep((s) => (s + 1) % PRESS_SEQUENCE.length)
    }, STEP_MS)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const target = containerRef.current
    if (!target || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / SCENE_WIDTH))
    })
    observer.observe(target)

    return () => observer.disconnect()
  }, [])

  const activeLetter = PRESS_SEQUENCE[step]

  return (
    <div
      className="hero-keyboard"
      ref={containerRef}
      aria-hidden="true"
      style={{ height: SCENE_HEIGHT * scale }}
    >
      <div
        className="hero-keyboard__viewport"
        style={{
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <div className="hero-keyboard__stage">
          <div className="hero-keyboard__ground" />
          {keys.map((k) => {
            const pressed = k.letter === activeLetter
            return (
              <div
                key={k.letter + k.ty}
                className={pressed ? 'hero-key hero-key--pressed' : 'hero-key'}
                style={
                  {
                    width: KEY_SIZE,
                    height: KEY_SIZE,
                    '--tx': `${k.tx}px`,
                    '--ty': `${k.ty}px`,
                    '--cap-h': `${CAP_HEIGHT}px`,
                  } as CSSProperties
                }
              >
                <div className="hero-key__left" />
                <div className="hero-key__front" />
                <div className="hero-key__top">{k.letter}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

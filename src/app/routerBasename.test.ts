import { describe, expect, it } from 'vitest'
import { deriveBasename } from './routerBasename'

describe('deriveBasename', () => {
  it('is unset at the domain root, so BrowserRouter uses its own default', () => {
    expect(deriveBasename('/')).toBeUndefined()
  })

  it('treats an empty base the same as the root', () => {
    expect(deriveBasename('')).toBeUndefined()
  })

  it('strips the trailing slash Vite always puts on BASE_URL', () => {
    expect(deriveBasename('/demos/typing-race/')).toBe('/demos/typing-race')
  })

  it('leaves an already-bare subpath unchanged', () => {
    expect(deriveBasename('/demos/typing-race')).toBe('/demos/typing-race')
  })
})

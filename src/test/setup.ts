import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement matchMedia - stub it globally so any component
// that reads prefers-reduced-motion/-color-scheme doesn't crash on mount.
// Defaults to "no match"; a test that cares about a specific query result
// reassigns window.matchMedia itself.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

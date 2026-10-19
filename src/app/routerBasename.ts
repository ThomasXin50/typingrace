/**
 * Derives BrowserRouter's `basename` from Vite's `import.meta.env.BASE_URL`
 * - one source of truth with vite.config.ts's `base`, instead of a second
 * hardcoded copy that could drift from it. BASE_URL is always `/` in dev
 * (unset basename, router behaves exactly as it does today) and the
 * configured subpath - always trailing-slashed - in a production build.
 */
export function deriveBasename(baseUrl: string): string | undefined {
  if (baseUrl === '/' || baseUrl === '') return undefined
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

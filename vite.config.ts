import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production is served at www.thomasxin.me/demos/typing-race/, a
  // subpath of a separate portfolio Vercel project that proxies to this
  // one (see issue #51) - every built asset reference needs that prefix
  // baked in, or the browser resolves them against the portfolio's own
  // root instead. Dev stays at the domain root; nothing about local
  // development goes through that proxy, so there's no reason to disturb
  // the existing localhost:5173/ workflow.
  base: command === 'build' ? '/demos/typing-race/' : '/',
  build: {
    // Nested to physically match `base`. The portfolio project's rewrite
    // forwards the whole /demos/typing-race/* prefix through unstripped
    // (every sub-resource request goes through it too, not just the page
    // load), so this project has to actually serve its own content back
    // at that same prefixed path on its own domain - not just reference
    // it in index.html.
    outDir: 'dist/demos/typing-race',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Edge Functions run on Deno and are tested with `deno test`, not
    // Vitest - their jsr:/npm: specifiers aren't resolvable here.
    exclude: ['**/node_modules/**', 'supabase/functions/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        '**/*.config.*',
        'dist/**',
      ],
    },
  },
}))

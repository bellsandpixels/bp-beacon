import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The Beacon authoring harness (cp-beacon-authoring-harness). A dev-only vite app: it renders the REAL
// @bp/beacon first-run panes and the REAL @bp/ui What's-new view, so a product's first-run content is
// authored and validated in-house. @bp/ui is aliased to the SIBLING bp-brand-kits checkout for the harness
// only; the published @bp/beacon package never gains an @bp/ui dependency (decision #108). This assumes the
// standard dev-root layout: bp-beacon and bp-brand-kits are siblings.
const u = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig({
  root: u('.'),
  plugins: [react()],
  resolve: {
    alias: {
      // most specific first
      '@bp/beacon/tour': u('../src/tour.ts'),
      '@bp/beacon': u('../src/index.ts'),
      '@bp/ui/app-frame': u('../../bp-brand-kits/b-p/src/app-frame/index.ts'),
      '@bp/ui/tokens.css': u('../../bp-brand-kits/b-p/src/tokens.css'),
      '@bp/ui/components.css': u('../../bp-brand-kits/b-p/src/components.css'),
      // bp-brand-kits is not installed as a sibling, so its one external import (clsx) must resolve to the
      // harness's copy rather than from bp-brand-kits's (absent) node_modules.
      clsx: u('../node_modules/clsx/dist/clsx.mjs'),
    },
  },
})

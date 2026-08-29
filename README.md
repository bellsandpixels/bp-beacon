# @bp/beacon

The shared Bells & Pixels **Beacon** feedback SDK. One design-system-agnostic web `FeedbackPane` + one
canonical adapter that speaks the client-portal `/api/beacon-signal` envelope, so every product (toudai,
fudemoji web, ...) files feedback through the **same** contract instead of a divergent port.

Governed by **client-portal** (decision #63). The wire envelope is canonical in client-portal
`docs/beacon-anon-ingest-spec.md`; a contract test there asserts this SDK's envelope matches the server.

## What's here

- `FeedbackPane` - the tokenless feedback form (Issue/Idea, title, details, consent + a "what's included"
  inspect). Themed entirely by `--beacon-*` CSS variables the host sets; no design-system dependency.
- `createBeaconAdapter({ endpoint, product, appName, appVersion, env })` - builds the envelope
  (`product/kind/title/details/consent/clientReportId/hp/context`) and POSTs it. Consent-gated D3 context.
- `gatherWebContext` / `buildEnvelope` - the allow-list diagnostics + the pure envelope builder (unit-testable).
  The consented D3 context is coarse ONLY: `appName/appVersion/env/platform`, `device` (phone/tablet/desktop),
  `os` (win/ios/android/mac/linux) + `osMajor` (the version detail), `route` (path), `locale`. Never a stable
  id / IP / full UA. `deviceFromUA` / `osFromUA` / `osMajorFromUA` are exported and unit-tested.
- Types: `FeedbackKind`, `FeedbackAdapter`, `BeaconEnvelope`, `BeaconContext`, `FeedbackStatus`, ...

The native (Android/iOS) KMP client stays in the fudemoji repo until a second native consumer exists; it
sends the **same** envelope.

## Consuming it

A git submodule under `vendor/` (mirrors `vendor/brand-kits` / `vendor/bp-qa`):

```
git submodule add https://github.com/bellsandpixels/bp-beacon.git vendor/bp-beacon
```

## Usage (web)

```tsx
import { FeedbackPane, createBeaconAdapter, gatherWebContext } from '@bp/beacon'

const cfg = { endpoint: '/api/feedback', product: 'toudai', appName: 'Toudai Studio', appVersion: '0.1.0', env: 'production' }
const adapter = createBeaconAdapter(cfg)

<FeedbackPane adapter={adapter} gatherContext={() => gatherWebContext(cfg)} />
```

Theme via CSS variables (all optional; neutral fallbacks):
`--beacon-fg`, `--beacon-accent`, `--beacon-accent-fg`, `--beacon-border`, `--beacon-field-bg`,
`--beacon-radius`, `--beacon-pad`, `--beacon-font`, `--beacon-error`, `--beacon-inspect-bg`.

## Build

```
npm ci && npm run build
```

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

## First-run and onboarding (web)

One shared first-run experience instead of each product hand-rolling its own. Three pieces on one
`OnboardingAdapter`, all themed by the same `--beacon-*` variables:

- `OnboardingPane`: a welcome card plus a "get started" checklist the product declares. Steps are ticked
  when the host calls `adapter.completeStep(id)` as the real action happens (or by hand with
  `manualComplete`).
- `CoachTour`: a spotlight tour over elements marked `data-beacon-tour="<target>"`. A step whose anchor is
  not on the page is passed over. Back / Next, arrow keys, and Esc to skip. Also published as
  `@bp/beacon/tour` so it can be lazy-loaded.
- `whatsNewSinceLastVisit(entries, currentVersion, lastSeenVersion)`: the entries newer than what the user
  last saw, and whether What's new should open. Never on a first visit, once per upgrade.

The user's choices, kept per product and user by `createLocalOnboardingStore` (localStorage, falling back
to memory when storage is blocked):

| Choice | Effect |
|---|---|
| **Skip for now** | Closes the pane. It may come back after `resurfaceAfterMs` (default 7 days) while the checklist is unfinished. Skipping a tour ends that tour for good. |
| **Don't show me this again** | Nothing opens by itself again, neither the pane nor any tour. The user can still open it by hand. |
| Seen version | `markVersionSeen(version)` after deciding, so What's new opens once per upgrade. |

```tsx
import {
  OnboardingPane, createLocalOnboardingStore, shouldAutoOpenOnboarding, shouldAutoStartTour,
  whatsNewSinceLastVisit,
} from '@bp/beacon'
const CoachTour = React.lazy(() => import('@bp/beacon/tour'))

const onboarding = createLocalOnboardingStore({ product: 'toudai', userKey: hashedUserId })
const steps = [{ id: 'brand', title: 'Set up your brand' }, { id: 'publish', title: 'Publish your site' }]

const state = await onboarding.load()
const openWelcome = shouldAutoOpenOnboarding(state, steps)
const runTour = shouldAutoStartTour(state, 'studio-intro')
const news = whatsNewSinceLastVisit(changelogEntries, appVersion, state.lastSeenVersion)
await onboarding.markVersionSeen(appVersion)

<OnboardingPane adapter={onboarding} steps={steps} intro="..." onClose={close} onStartTour={startTour} />
<CoachTour adapter={onboarding} tourId="studio-intro" steps={[{ target: 'publish', title: 'Publish here' }]} onClose={endTour} />
```

Tour-only variables: `--beacon-bg` / `--beacon-tour-bg` (card), `--beacon-tour-scrim`, `--beacon-tour-z`.
A server-backed adapter (cross-device) can replace the local store without a consumer change: the
contract is async.

## Build

```
npm ci && npm run build
```

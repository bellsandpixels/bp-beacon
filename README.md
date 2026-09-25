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
  not on the page is passed over. Back / Next, arrow keys, and Esc to skip. It is a modal dialog: Tab and
  Shift+Tab wrap around the card's own controls, and focus that lands on the page underneath is pulled
  back. Published on `@bp/beacon/tour` only, which the hook below loads lazily, so a plain import of
  `@bp/beacon` never carries the tour code.
- `whatsNewSinceLastVisit(entries, currentVersion, lastSeenVersion)`: the entries newer than what the user
  last saw, and whether What's new should open. Never on a first visit, once per upgrade.

The user's choices, kept per product and user by `createLocalOnboardingStore` (localStorage, falling back
to memory when storage is blocked):

| Choice | Effect |
|---|---|
| **Skip for now** | Closes the pane. It may come back after `resurfaceAfterMs` (default 7 days) while the checklist is unfinished. Skipping a tour ends that tour for good. |
| **Don't show me this again** | Nothing opens by itself again, neither the pane nor any tour. The user can still open it by hand. |
| Seen version | `markVersionSeen(version)` after deciding, so What's new opens once per upgrade. |

The pieces above (`OnboardingPane`, `CoachTour` on `@bp/beacon/tour`, the store and policy helpers,
`whatsNewSinceLastVisit`) are exported for a host that is not the Beacon bar. A product never assembles
them itself: it mounts the hook.

**In the Beacon bar: one hook, written once.**
`useBeaconOnboarding` is the single wiring every product mounts (fudemoji, toudai and ike are the primary
surfaces, and this is not written three times): it owns the store, the seen version, what opens by itself,
the "New" tags, the welcome pane and the lazily loaded tour, and returns plain props that `@bp/ui`'s
AppFrame accepts (`renderOnboarding`, `autoOpen`, `newVersions`), so `@bp/ui` stays free of this package.

```tsx
import { AppFrame, parseChangelog } from '@bp/ui/app-frame'
import { useBeaconOnboarding } from '@bp/beacon'

const entries = useMemo(() => parseChangelog(changelogMarkdown), [changelogMarkdown])
const onboarding = useBeaconOnboarding({
  product: 'toudai', entries, steps,
  tour: { id: 'studio-intro', steps: [{ target: 'publish', title: 'Publish here' }] },
})
<AppFrame {...onboarding.frame} changelogMarkdown={changelogMarkdown} ... />
{onboarding.tour}
```

The rule it applies, once, in `decideAutoOpen`: after an upgrade What's new opens with the unseen entries
tagged "New"; on a first run the welcome opens; when both are due What's new wins (it is once per upgrade,
and an unfinished welcome comes back on a later visit). "Don't show me this again" silences the welcome and
every tour, not release notes (`policy.whatsNewOnUpgrade: false` turns those off). `version` defaults to
the newest changelog entry with a real version, so a top "Unreleased" heading does not disable it.
`whatsNewKey: 'date'` keys What's new on the entries' ISO dates instead of their versions, for a product
whose deploy pipeline stamps the build number into the top heading (client-portal): a restamped label never
reopens What's new, a note with a new date does. `enabled: false` (signed out, a ring that hides it) offers
and opens nothing.

Tour-only variables: `--beacon-bg` / `--beacon-tour-bg` (card), `--beacon-tour-scrim`, `--beacon-tour-z`.
A server-backed adapter (cross-device) can replace the local store without a consumer change: the
contract is async.

## Build

```
npm ci && npm run build
```

// The ONE first-run wiring every product mounts (owner ruling 2026-09-24: the primary Beacon surfaces are
// fudemoji, toudai and ike, and this functionality is written once, not three times with variations).
//
// A product passes its config and spreads the result into the @bp/ui AppFrame:
//
//   const onboarding = useBeaconOnboarding({ product: 'toudai', entries, steps, tour })
//   <AppFrame {...onboarding.frame} ... />
//   {onboarding.tour}
//
// Everything else is here: the store, the seen version, what opens by itself (What's new after an
// upgrade, the welcome on a first run), the "New" tags, the welcome pane with its Skip and "Don't show
// me this again", and the lazily loaded coach-mark tour. @bp/ui stays free of this package: the hook
// returns plain props that AppFrame's renderOnboarding / autoOpen / newVersions accept structurally.

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { OnboardingPane } from './OnboardingPane.js'
import { createLocalOnboardingStore, isChecklistDone } from './onboardingStore.js'
import { decideAutoOpen, newestParseableVersion, type AutoOpenPanel } from './onboardingDecide.js'
import {
  newestEntryDate,
  parseVersion,
  whatsNewSinceLastVisit,
  whatsNewSinceLastVisitByDate,
  type VersionedEntry,
} from './whatsNew.js'
import type { OnboardingAdapter, OnboardingPolicy, OnboardingState, OnboardingStep, TourStep } from './onboardingTypes.js'

// The tour is its own chunk: a product that never starts one ships none of it.
const LazyCoachTour = lazy(() => import('./tour.js'))

export interface BeaconOnboardingConfig {
  product: string // e.g. 'toudai'; keys the stored choices
  userKey?: string // a stable, non-identifying key for the signed-in user; omitted -> per browser
  // The running version. Default, and the fallback when this has no numeric part (a "dev" build stamp):
  // the newest changelog entry with a real version (a top "Unreleased" heading is skipped).
  version?: string
  // The product's changelog entries, newest first: parseChangelog(changelogMarkdown) from @bp/ui.
  entries: readonly VersionedEntry[]
  // What identifies a release note. 'version' (default) compares the headings' versions. 'date' compares
  // their ISO dates instead, for a product whose deploy pipeline rewrites the top heading's version on every
  // build (client-portal stamps Major.Minor.<run number> into it): a restamped label never reopens What's
  // new, a note with a new date does. In date mode `version` is ignored and the marker recorded as seen is
  // the newest date.
  whatsNewKey?: 'version' | 'date'
  steps: readonly OnboardingStep[]
  title?: string
  intro?: string
  manualComplete?: boolean
  // A guided tour offered from the welcome pane ("Show me around"). Absent -> no tour affordance.
  tour?: { id: string; steps: readonly TourStep[] }
  policy?: OnboardingPolicy & { whatsNewOnUpgrade?: boolean }
  // A server-backed store (cross-device) in place of the default local one.
  adapter?: OnboardingAdapter
  // false -> nothing is offered or opened (e.g. signed out, or a ring that hides it). Default true.
  enabled?: boolean
  // The product's --beacon-* mapping, the same object it hands FeedbackPane; applied around the welcome
  // pane and the tour so they render in the product's palette.
  style?: CSSProperties
}

// Structurally the AppFrame props of the same names (typed here so @bp/beacon needs no @bp/ui).
export interface BeaconOnboardingFrameProps {
  autoOpen?: AutoOpenPanel
  newVersions?: string[]
  renderOnboarding?: (ctx: { onClose: () => void }) => ReactNode
}

export interface BeaconOnboarding {
  frame: BeaconOnboardingFrameProps
  tour: ReactNode // render it once, anywhere in the tree
  state: OnboardingState | null // null until loaded (storage is client-only)
  adapter: OnboardingAdapter
  startTour: () => void
}

export function useBeaconOnboarding(config: BeaconOnboardingConfig): BeaconOnboarding {
  const { product, userKey, entries, steps, title, intro, manualComplete, tour, policy, enabled = true, style } = config
  const override = config.adapter
  const adapter = useMemo(
    () => override ?? createLocalOnboardingStore({ product, userKey }),
    [override, product, userKey],
  )
  const whatsNewKey = config.whatsNewKey ?? 'version'
  const version =
    whatsNewKey === 'date'
      ? newestEntryDate(entries)
      : ((config.version && parseVersion(config.version) ? config.version : undefined) ?? newestParseableVersion(entries))

  const [state, setState] = useState<OnboardingState | null>(null)
  const [autoOpen, setAutoOpen] = useState<AutoOpenPanel>()
  const [newVersions, setNewVersions] = useState<string[]>()
  const [touring, setTouring] = useState(false)

  // Decide after mount (never during render: storage is client-only and must not affect SSR), then
  // record the version as seen so What's new opens once per upgrade, not every visit.
  useEffect(() => {
    if (!enabled) return
    let live = true
    void (async () => {
      try {
        const loaded = await adapter.load()
        const news = !version
          ? null
          : whatsNewKey === 'date'
            ? whatsNewSinceLastVisitByDate(entries, version, loaded.lastSeenVersion)
            : whatsNewSinceLastVisit(entries, version, loaded.lastSeenVersion)
        const open = decideAutoOpen(news, loaded, steps, new Date(), policy)
        const marked = version && loaded.lastSeenVersion !== version ? await adapter.markVersionSeen(version) : loaded
        if (!live) return
        setState(marked)
        setNewVersions(news?.shouldOpen ? news.entries.map((e) => e.version) : undefined)
        setAutoOpen(open)
      } catch {
        // A store that cannot load must never break the product: offer nothing this visit.
      }
    })()
    return () => {
      live = false
    }
    // steps/policy are config literals in practice; re-deciding on their identity would re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, version, whatsNewKey, entries, enabled])

  const startTour = useCallback(() => setTouring(true), [])

  const offer = enabled && !!state && !isChecklistDone(state, steps)
  const renderOnboarding = useMemo(
    () =>
      offer
        ? ({ onClose }: { onClose: () => void }) => (
            <div style={style}>
              <OnboardingPane
                adapter={adapter}
                steps={steps}
                title={title}
                intro={intro}
                manualComplete={manualComplete}
                onClose={onClose}
                onStateChange={setState}
                onStartTour={
                  tour
                    ? () => {
                        onClose()
                        setTouring(true)
                      }
                    : undefined
                }
              />
            </div>
          )
        : undefined,
    [offer, adapter, steps, title, intro, manualComplete, tour, style],
  )

  const tourNode =
    touring && tour ? (
      <div style={style}>
        <Suspense fallback={null}>
          <LazyCoachTour adapter={adapter} tourId={tour.id} steps={tour.steps} onClose={() => setTouring(false)} />
        </Suspense>
      </div>
    ) : null

  return {
    frame: enabled ? { autoOpen, newVersions, renderOnboarding } : {},
    tour: tourNode,
    state,
    adapter,
    startTour,
  }
}

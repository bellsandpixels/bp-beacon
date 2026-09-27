// The one first-time MOMENT wiring every product mounts (owner ruling 2026-09-24: first-run behavior is written
// once, in the Beacon). BeaconFrame calls it with the same OnboardingAdapter as the welcome and the tours, so a
// product only declares its moments and announces them:
//
//   <BeaconFrame ... moments={[{ id: 'save', title: 'Saved', body: '...' }]} />
//   announceMoment('save')   // after the real save, from anywhere in the app
//
// The hook listens for announcements while enabled, reads the store at that moment (so a choice made in another
// tab or on the welcome is honored), asks shouldShowMoment, shows MomentPane, and records the outcome. Two moments
// announced back to back queue rather than replace each other. Client-only: nothing runs during render.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MomentPane } from './MomentPane.js'
import { MOMENT_EVENT, findMoment, momentOutcome, shouldShowMoment } from './moments.js'
import type { Moment, OnboardingAdapter } from './onboardingTypes.js'

export interface BeaconMomentsConfig {
  adapter: OnboardingAdapter
  moments: readonly Moment[]
  enabled?: boolean // false -> announcements are ignored (e.g. signed out). Default true.
  style?: CSSProperties // the product's --beacon-* mapping
}

export interface BeaconMoments {
  node: ReactNode // render it once, anywhere in the tree
  show: (momentId: string) => void // the same as announceMoment(momentId), without the window event
}

export function useBeaconMoments({ adapter, moments, enabled = true, style }: BeaconMomentsConfig): BeaconMoments {
  const [queue, setQueue] = useState<Moment[]>([])
  const shownThisVisit = useRef<Set<string>>(new Set())
  // The latest declarations without re-binding the listener: moments are usually a config literal.
  const momentsRef = useRef(moments)
  momentsRef.current = moments

  const show = useCallback(
    (momentId: string) => {
      const moment = findMoment(momentsRef.current, momentId)
      if (!enabled || !moment || shownThisVisit.current.has(moment.id)) return
      // Claim the visit slot before the async read, so a double announce cannot open it twice.
      shownThisVisit.current.add(moment.id)
      void (async () => {
        try {
          const state = await adapter.load()
          if (shouldShowMoment(state, moment)) setQueue((q) => [...q, moment])
        } catch {
          // A store that cannot load must never break the product: no explainer this time.
        }
      })()
    },
    [adapter, enabled],
  )

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const onMoment = (e: Event) => show((e as CustomEvent<unknown>).detail as string)
    window.addEventListener(MOMENT_EVENT, onMoment)
    return () => window.removeEventListener(MOMENT_EVENT, onMoment)
  }, [enabled, show])

  const current = queue[0]
  const close = useCallback(
    (dontShowAgain: boolean) => {
      if (!current) return
      const outcome = momentOutcome(current, dontShowAgain)
      if (outcome && adapter.recordMoment) {
        adapter.recordMoment(current.id, outcome).catch(() => {
          // Not remembered: the explainer may show again on a later visit. Never trap the user.
        })
      }
      setQueue((q) => q.slice(1))
    },
    [adapter, current],
  )

  const node =
    enabled && current ? (
      <div style={style}>
        <MomentPane key={current.id} moment={current} onClose={close} />
      </div>
    ) : null

  return { node, show }
}

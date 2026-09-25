// The shared Beacon COACH-MARK TOUR: a spotlight on one element at a time with a short card beside it.
// Hosts mark the elements with data-beacon-tour="<target>" and pass the steps; a step whose anchor is not
// on the page is passed over. Themed by --beacon-* variables like the other panes. Every step offers
// Back / Next, "Skip tour" (Esc does the same), and the same "Don't show me this again" toggle as the
// welcome pane. Finishing or skipping records the tour as done so it never auto-starts again; whether to
// start it automatically is the host's call via shouldAutoStartTour.
//
// Kept in its own module (and the "@bp/beacon/tour" subpath) so a product can lazy-load it: a product
// that never runs a tour ships none of it.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { OnboardingAdapter, OnboardingState, TourOutcome, TourStep } from './onboardingTypes.js'
import { placeTourCard, type CardPlacement, type Rect } from './tourPlacement.js'
import { TOUR_FOCUSABLE, trapFocusTarget } from './tourFocus.js'

export interface CoachTourProps {
  adapter: OnboardingAdapter
  tourId: string // one-shot key; recorded as completed/skipped when the tour ends
  steps: readonly TourStep[]
  onClose: (outcome: TourOutcome) => void
  root?: ParentNode // where to look for anchors (default: document)
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`
const SPOT_PAD = 6

function findAnchor(root: ParentNode, target: string): HTMLElement | null {
  const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(target) : target.replace(/["\\]/g, '\\$&')
  return root.querySelector<HTMLElement>(`[data-beacon-tour="${esc}"]`)
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function CoachTour({ adapter, tourId, steps, onClose, root }: CoachTourProps) {
  const scope: ParentNode | undefined = root ?? (typeof document !== 'undefined' ? document : undefined)
  // The steps whose anchors are on the page when the tour starts.
  const [live] = useState(() => (scope ? steps.filter((s) => findAnchor(scope, s.target)) : []))
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [place, setPlace] = useState<CardPlacement | null>(null)
  const [state, setState] = useState<OnboardingState | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const ending = useRef(false)
  const titleId = useId()
  const toggleId = useId()
  const step = live[index]

  useEffect(() => {
    let on = true
    adapter
      .load()
      .then((s) => on && setState(s))
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [adapter])

  const end = useCallback(
    async (outcome: TourOutcome) => {
      if (ending.current) return
      ending.current = true
      try {
        await adapter.finishTour(tourId, outcome)
      } catch {
        // Never trap the user in the tour because the record did not save.
      }
      onClose(outcome)
    },
    [adapter, tourId, onClose],
  )

  // No anchors on the page: nothing to show. Close WITHOUT recording, so the tour can run on a later
  // visit when its anchors exist.
  useEffect(() => {
    if (!live.length && !ending.current) {
      ending.current = true
      onClose('skipped')
    }
  }, [live.length, onClose])

  // Measure the anchor and place the card; re-measure on scroll and resize.
  const measure = useCallback(() => {
    if (!step || !scope) return
    const el = findAnchor(scope, step.target)
    const r = el?.getBoundingClientRect()
    const nextRect = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
    setRect(nextRect)
    const card = cardRef.current
    const size = card ? { width: card.offsetWidth, height: card.offsetHeight } : { width: 300, height: 160 }
    setPlace(placeTourCard(nextRect, size, { width: window.innerWidth, height: window.innerHeight }))
  }, [step, scope])

  useLayoutEffect(() => {
    if (!step || !scope) return
    findAnchor(scope, step.target)?.scrollIntoView?.({
      block: 'center',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    measure()
  }, [step, scope, measure])

  // Focus the card once it is placed (a visibility:hidden card cannot take focus), so Esc and the arrow
  // keys work from the first step without a click.
  const placed = place !== null
  useEffect(() => {
    if (placed) cardRef.current?.focus({ preventScroll: true })
  }, [step, placed])

  // Keep focus inside the card while the tour runs: if anything moves it onto the page underneath (a
  // script, an assistive-tech jump), bring it back, so the modal promise of aria-modal holds.
  useEffect(() => {
    if (!step) return
    const onFocusIn = (e: FocusEvent) => {
      const card = cardRef.current
      if (card && e.target instanceof Node && !card.contains(e.target)) card.focus({ preventScroll: true })
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [step])

  useEffect(() => {
    if (!step) return
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [step, measure])

  const last = index >= live.length - 1
  const next = () => (last ? void end('completed') : setIndex((i) => i + 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      void end('skipped')
    } else if (e.key === 'ArrowRight') {
      next()
    } else if (e.key === 'ArrowLeft') {
      back()
    } else if (e.key === 'Tab') {
      // Wrap Tab and Shift+Tab around the card's own controls instead of leaving the dialog.
      const card = cardRef.current
      if (!card) return
      const controls = Array.from(card.querySelectorAll<HTMLElement>(TOUR_FOCUSABLE))
      const current = controls.indexOf(document.activeElement as HTMLElement)
      const target = trapFocusTarget(current, controls.length, e.shiftKey)
      if (controls.length === 0) {
        e.preventDefault()
      } else if (target !== null) {
        e.preventDefault()
        controls[target]?.focus()
      }
    }
  }

  if (!step) return null

  const quiet: React.CSSProperties = {
    font: 'inherit',
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: v('radius', '8px'),
    background: 'transparent',
    color: 'inherit',
    border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
    cursor: 'pointer',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: v('tour-z', '2147483000') }}>
      {/* Click shield: the page underneath is not interactive while the tour runs. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
      {rect ? (
        <div
          aria-hidden="true"
          data-beacon-tour-spotlight=""
          style={{
            position: 'absolute',
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            borderRadius: v('radius', '8px'),
            boxShadow: `0 0 0 9999px ${v('tour-scrim', 'rgba(0,0,0,.55)')}`,
            outline: `2px solid ${v('accent', '#2563eb')}`,
            pointerEvents: 'none',
            transition: prefersReducedMotion() ? 'none' : 'all .2s ease',
          }}
        />
      ) : (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: v('tour-scrim', 'rgba(0,0,0,.55)') }} />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{
          position: 'absolute',
          top: place?.top ?? 0,
          left: place?.left ?? 0,
          visibility: place ? 'visible' : 'hidden',
          width: 'min(320px, calc(100vw - 32px))',
          boxSizing: 'border-box',
          display: 'grid',
          gap: 10,
          padding: 14,
          borderRadius: v('radius', '8px'),
          background: v('tour-bg', v('bg', '#fff')),
          color: v('fg', '#111'),
          fontFamily: v('font', 'system-ui, sans-serif'),
          border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
          boxShadow: '0 8px 30px rgba(0,0,0,.25)',
          outline: 'none',
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.65 }}>
          {index + 1} of {live.length}
        </div>
        <div id={titleId} style={{ fontSize: 15, fontWeight: 600 }}>
          {step.title}
        </div>
        {step.body ? <div style={{ fontSize: 13, opacity: 0.85 }}>{step.body}</div> : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...quiet, border: 'none', paddingLeft: 0, opacity: 0.8 }} onClick={() => void end('skipped')}>
            Skip tour
          </button>
          <span style={{ flex: 1 }} />
          {index > 0 ? (
            <button type="button" style={quiet} onClick={back}>
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            style={{ ...quiet, background: v('accent', '#2563eb'), color: v('accent-fg', '#fff'), border: '1px solid transparent' }}
          >
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
        <label htmlFor={toggleId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, opacity: 0.8, cursor: 'pointer' }}>
          <input
            id={toggleId}
            type="checkbox"
            checked={!!state?.suppressed}
            disabled={!state}
            onChange={(e) => {
              const suppressed = e.currentTarget.checked
              adapter
                .setSuppressed(suppressed)
                .then(setState)
                .catch(() => undefined)
            }}
          />
          Don't show me this again
        </label>
      </div>
    </div>
  )
}

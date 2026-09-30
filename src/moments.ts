// First-time MOMENT explainers: the pure rules, written once for every product (owner ruling 2026-09-24:
// first-run behavior lives in the Beacon, not per product). A product declares its moments (id + copy) and
// announces one with announceMoment(id) from wherever the real action happens; useBeaconMoments listens, asks
// shouldShowMoment, shows MomentPane, and records the outcome in the same OnboardingState as the welcome and
// the tours. Everything here is pure except announceMoment, which only dispatches a window event.

import type { Moment, MomentOutcome, OnboardingState } from './onboardingTypes.js'

// The window event a moment is announced on. Namespaced so it never collides with a product's own events.
export const MOMENT_EVENT = 'bp:beacon:moment'

// Announce that a moment happened (e.g. announceMoment('save') after a real save). A no-op on the server and
// whenever the explainer is not due; the host decides nothing.
export function announceMoment(momentId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(MOMENT_EVENT, { detail: momentId }))
}

// Whether an announced moment should open now. "Don't show me this again" on the welcome (suppressed) silences
// every moment; a hidden moment never shows; a seen moment shows again only when it repeats; and nothing shows
// twice in one visit (shownThisVisit is the host's in-memory record).
export function shouldShowMoment(
  state: OnboardingState,
  moment: Pick<Moment, 'id' | 'repeat'>,
  shownThisVisit: ReadonlySet<string> = new Set(),
): boolean {
  if (state.suppressed) return false
  if (shownThisVisit.has(moment.id)) return false
  const outcome = state.moments?.[moment.id]
  if (outcome === 'hidden') return false
  if (outcome === 'seen' && !moment.repeat) return false
  return true
}

// What closing the explainer records. A once-only moment is always recorded (ticked or not, it is done); a
// repeating one is recorded only when the user ticked "Don't show this again", otherwise it comes back next visit.
export function momentOutcome(moment: Pick<Moment, 'repeat'>, dontShowAgain: boolean): MomentOutcome | undefined {
  if (dontShowAgain) return 'hidden'
  return moment.repeat ? undefined : 'seen'
}

// Record an outcome in the state. 'hidden' is final: a later 'seen' never downgrades it.
export function withMomentOutcome(state: OnboardingState, momentId: string, outcome: MomentOutcome): OnboardingState {
  const current = state.moments?.[momentId]
  if (current === 'hidden' || current === outcome) return state
  return { ...state, moments: { ...state.moments, [momentId]: outcome } }
}

// The explainer's paragraphs: an array as given, a string split on blank lines. Empty paragraphs are dropped.
/** Whether a pointer press landed outside the explainer card (so it closes the moment and passes through to the page).
 *  DOM-free for the node test runner: anything with a `contains` method stands in for the card element. A missing
 *  card (not mounted yet) never closes. */
export function isOutsideCard(target: unknown, card: { contains: (n: never) => boolean } | null): boolean {
  if (!card) return false
  if (!target || typeof target !== 'object') return true
  return !card.contains(target as never)
}

export function momentParagraphs(body: Moment['body']): string[] {
  const parts = typeof body === 'string' ? body.split(/\n\s*\n/) : [...body]
  return parts.map((p) => p.trim()).filter(Boolean)
}

// Find a declared moment by id (own ids only; an unknown announcement is ignored).
export function findMoment(moments: readonly Moment[], momentId: unknown): Moment | undefined {
  return typeof momentId === 'string' ? moments.find((m) => m.id === momentId) : undefined
}

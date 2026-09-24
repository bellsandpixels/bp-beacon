// The default OnboardingAdapter: state in the browser's localStorage, one record per product + user, plus
// the pure policy that decides what opens automatically. Storage can be missing or throw (private mode,
// blocked site data, SSR), so every read and write is guarded and the store falls back to memory: the
// first-run still works for the visit, it just may show again next time.

import type { OnboardingAdapter, OnboardingPolicy, OnboardingState, OnboardingStep, TourOutcome } from './onboardingTypes.js'

export type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface LocalOnboardingStoreConfig {
  product: string // e.g. 'toudai'; keeps each product's first-run separate on a shared origin
  // A stable, non-identifying key for the signed-in user (e.g. a hashed id), so a shared browser keeps
  // each user's choices apart. Omitted -> 'anon' (per browser).
  userKey?: string
  storage?: OnboardingStorage // injectable for tests; defaults to window.localStorage when available
  now?: () => Date
}

export const DEFAULT_RESURFACE_MS = 7 * 24 * 60 * 60 * 1000

export function emptyOnboardingState(): OnboardingState {
  return { completed: [], suppressed: false, tours: {} }
}

export function onboardingStorageKey(product: string, userKey?: string): string {
  return `bp:beacon:onboarding:${product}:${userKey || 'anon'}`
}

// Parse defensively: a hand-edited or older record must never break the first-run, so anything
// unrecognized falls back to the empty state field by field.
export function parseOnboardingState(raw: string | null): OnboardingState {
  if (!raw) return emptyOnboardingState()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return emptyOnboardingState()
  }
  if (!data || typeof data !== 'object') return emptyOnboardingState()
  const d = data as Record<string, unknown>
  const tours: Record<string, TourOutcome> = {}
  if (d.tours && typeof d.tours === 'object') {
    for (const [k, val] of Object.entries(d.tours as Record<string, unknown>)) {
      if (val === 'completed' || val === 'skipped') tours[k] = val
    }
  }
  return {
    completed: Array.isArray(d.completed) ? d.completed.filter((x): x is string => typeof x === 'string') : [],
    skippedAt: typeof d.skippedAt === 'string' ? d.skippedAt : undefined,
    suppressed: d.suppressed === true,
    tours,
    lastSeenVersion: typeof d.lastSeenVersion === 'string' ? d.lastSeenVersion : undefined,
  }
}

function defaultStorage(): OnboardingStorage | undefined {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

export function createLocalOnboardingStore(config: LocalOnboardingStoreConfig): OnboardingAdapter {
  const key = onboardingStorageKey(config.product, config.userKey)
  const storage = config.storage ?? defaultStorage()
  const now = config.now ?? (() => new Date())
  let memory: OnboardingState | null = null

  const read = (): OnboardingState => {
    if (memory) return memory
    let raw: string | null = null
    try {
      raw = storage ? storage.getItem(key) : null
    } catch {
      raw = null
    }
    memory = parseOnboardingState(raw)
    return memory
  }

  const write = (next: OnboardingState): OnboardingState => {
    memory = next
    try {
      storage?.setItem(key, JSON.stringify(next))
    } catch {
      // Quota or blocked storage: keep the in-memory copy so this visit still behaves.
    }
    return next
  }

  const update = async (fn: (s: OnboardingState) => OnboardingState) => write(fn(read()))

  return {
    load: async () => read(),
    completeStep: (stepId) =>
      update((s) => (s.completed.includes(stepId) ? s : { ...s, completed: [...s.completed, stepId] })),
    skip: () => update((s) => ({ ...s, skippedAt: now().toISOString() })),
    setSuppressed: (suppressed) => update((s) => ({ ...s, suppressed })),
    finishTour: (tourId, outcome) => update((s) => ({ ...s, tours: { ...s.tours, [tourId]: outcome } })),
    markVersionSeen: (version) => update((s) => ({ ...s, lastSeenVersion: version })),
    reset: async () => {
      memory = emptyOnboardingState()
      try {
        storage?.removeItem(key)
      } catch {
        // ignore; memory is already reset
      }
      return memory
    },
  }
}

// ---- policy: what opens by itself -------------------------------------------------------------------

export function isChecklistDone(state: OnboardingState, steps: readonly OnboardingStep[]): boolean {
  return steps.every((s) => state.completed.includes(s.id))
}

// Auto-open the welcome pane only when the user has not opted out, the checklist is unfinished, and any
// Skip is older than the resurface window. Opening it by hand is always allowed; this governs only the
// automatic first-run.
export function shouldAutoOpenOnboarding(
  state: OnboardingState,
  steps: readonly OnboardingStep[],
  now: Date = new Date(),
  policy: OnboardingPolicy = {},
): boolean {
  if (state.suppressed) return false
  if (steps.length && isChecklistDone(state, steps)) return false
  if (state.skippedAt) {
    const skipped = Date.parse(state.skippedAt)
    const quiet = policy.resurfaceAfterMs ?? DEFAULT_RESURFACE_MS
    if (!Number.isNaN(skipped) && now.getTime() - skipped < quiet) return false
  }
  return true
}

// Tours are one-shot: once finished or skipped they never auto-start again, and "don't show again"
// stops every tour.
export function shouldAutoStartTour(state: OnboardingState, tourId: string): boolean {
  return !state.suppressed && !state.tours[tourId]
}

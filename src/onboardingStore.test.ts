// The first-run store + policy: Skip is "not now", "Don't show me this again" silences everything, the
// seen version persists, each product + user is kept apart, and broken storage never breaks the first-run.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createLocalOnboardingStore,
  DEFAULT_RESURFACE_MS,
  onboardingStorageKey,
  parseOnboardingState,
  shouldAutoOpenOnboarding,
  shouldAutoStartTour,
  type OnboardingStorage,
} from './onboardingStore.js'
import type { OnboardingStep } from './onboardingTypes.js'

const memStorage = (): OnboardingStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, val) => void data.set(k, val),
    removeItem: (k) => void data.delete(k),
  }
}
const steps: OnboardingStep[] = [
  { id: 'profile', title: 'Add your profile' },
  { id: 'first-report', title: 'Open your first report' },
]
const T0 = new Date('2026-09-24T12:00:00Z')

test('a fresh user gets the welcome pane', async () => {
  const store = createLocalOnboardingStore({ product: 'toudai', storage: memStorage() })
  assert.equal(shouldAutoOpenOnboarding(await store.load(), steps, T0), true)
})

test('completeStep persists and is idempotent; a finished checklist stops auto-open', async () => {
  const storage = memStorage()
  const store = createLocalOnboardingStore({ product: 'toudai', storage })
  await store.completeStep('profile')
  await store.completeStep('profile')
  const s = await store.completeStep('first-report')
  assert.deepEqual(s.completed, ['profile', 'first-report'])
  assert.equal(shouldAutoOpenOnboarding(s, steps, T0), false)
  // A new store over the same storage (the next visit) reads it back.
  const again = await createLocalOnboardingStore({ product: 'toudai', storage }).load()
  assert.deepEqual(again.completed, ['profile', 'first-report'])
})

test('Skip is "not now": closed during the quiet window, back after it while unfinished', async () => {
  const store = createLocalOnboardingStore({ product: 'toudai', storage: memStorage(), now: () => T0 })
  const s = await store.skip()
  assert.equal(s.skippedAt, T0.toISOString())
  assert.equal(shouldAutoOpenOnboarding(s, steps, new Date(T0.getTime() + 60_000)), false)
  assert.equal(shouldAutoOpenOnboarding(s, steps, new Date(T0.getTime() + DEFAULT_RESURFACE_MS + 1)), true)
  assert.equal(
    shouldAutoOpenOnboarding(s, steps, new Date(T0.getTime() + DEFAULT_RESURFACE_MS * 10), { resurfaceAfterMs: Infinity }),
    false,
  )
})

test('"Don\'t show me this again" silences the pane AND every tour, and can be undone', async () => {
  const store = createLocalOnboardingStore({ product: 'toudai', storage: memStorage() })
  let s = await store.setSuppressed(true)
  assert.equal(shouldAutoOpenOnboarding(s, steps, T0), false)
  assert.equal(shouldAutoStartTour(s, 'intro'), false)
  s = await store.setSuppressed(false)
  assert.equal(shouldAutoOpenOnboarding(s, steps, T0), true)
  assert.equal(shouldAutoStartTour(s, 'intro'), true)
})

test('tours are one-shot: finished or skipped never auto-start again; other tours still can', async () => {
  const store = createLocalOnboardingStore({ product: 'toudai', storage: memStorage() })
  let s = await store.finishTour('intro', 'skipped')
  assert.equal(shouldAutoStartTour(s, 'intro'), false)
  assert.equal(shouldAutoStartTour(s, 'reports'), true)
  s = await store.finishTour('reports', 'completed')
  assert.deepEqual(s.tours, { intro: 'skipped', reports: 'completed' })
})

test('the seen version persists across visits', async () => {
  const storage = memStorage()
  await createLocalOnboardingStore({ product: 'toudai', storage }).markVersionSeen('0.5.1865')
  assert.equal((await createLocalOnboardingStore({ product: 'toudai', storage }).load()).lastSeenVersion, '0.5.1865')
})

test('each product and each user keeps separate choices', async () => {
  const storage = memStorage()
  await createLocalOnboardingStore({ product: 'toudai', userKey: 'u1', storage }).setSuppressed(true)
  assert.equal((await createLocalOnboardingStore({ product: 'toudai', userKey: 'u2', storage }).load()).suppressed, false)
  assert.equal((await createLocalOnboardingStore({ product: 'fudemoji', userKey: 'u1', storage }).load()).suppressed, false)
  assert.ok(storage.data.has(onboardingStorageKey('toudai', 'u1')))
  assert.equal(onboardingStorageKey('ike'), 'bp:beacon:onboarding:ike:anon')
})

test('reset clears the record', async () => {
  const storage = memStorage()
  const store = createLocalOnboardingStore({ product: 'toudai', storage })
  await store.setSuppressed(true)
  const s = await store.reset()
  assert.equal(s.suppressed, false)
  assert.equal(storage.data.size, 0)
})

test('storage that throws never breaks the first-run (memory fallback for the visit)', async () => {
  const broken: OnboardingStorage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }
  const store = createLocalOnboardingStore({ product: 'toudai', storage: broken })
  assert.equal((await store.load()).suppressed, false)
  assert.equal((await store.setSuppressed(true)).suppressed, true)
  assert.equal((await store.load()).suppressed, true)
  assert.equal((await store.reset()).suppressed, false)
})

test('no storage at all (SSR / node) still works in memory', async () => {
  const store = createLocalOnboardingStore({ product: 'toudai' })
  assert.deepEqual((await store.completeStep('profile')).completed, ['profile'])
})

test('a corrupt or foreign record parses field by field to safe defaults', () => {
  assert.deepEqual(parseOnboardingState('not json'), { completed: [], suppressed: false, tours: {} })
  const s = parseOnboardingState(
    JSON.stringify({ completed: ['a', 3], suppressed: 'yes', tours: { t: 'bogus', u: 'completed' }, lastSeenVersion: 1 }),
  )
  assert.deepEqual(s.completed, ['a'])
  assert.equal(s.suppressed, false)
  assert.deepEqual(s.tours, { u: 'completed' })
  assert.equal(s.lastSeenVersion, undefined)
})

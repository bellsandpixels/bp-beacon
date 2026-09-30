// First-time moment explainers: shown once per user (or once per visit until hidden), silenced by the shared
// "Don't show me this again", and recorded in the same OnboardingState the store persists.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMoment, isOutsideCard, momentOutcome, momentParagraphs, shouldShowMoment, withMomentOutcome } from './moments.js'
import { createLocalOnboardingStore, emptyOnboardingState, parseOnboardingState } from './onboardingStore.js'
import type { Moment, OnboardingState } from './onboardingTypes.js'

const once: Moment = { id: 'save', title: 'Saved' }
const repeating: Moment = { id: 'publish', title: 'Publishing', repeat: true }
const withOutcome = (m: OnboardingState['moments']): OnboardingState => ({ ...emptyOnboardingState(), moments: m })

test('a new moment shows', () => {
  assert.equal(shouldShowMoment(emptyOnboardingState(), once), true)
  assert.equal(shouldShowMoment(emptyOnboardingState(), repeating), true)
})

test('an adapter state without moments still shows (older store)', () => {
  const { moments: _drop, ...legacy } = emptyOnboardingState()
  assert.equal(shouldShowMoment(legacy as OnboardingState, once), true)
})

test('"Don\'t show me this again" on the welcome silences every moment', () => {
  const s = { ...emptyOnboardingState(), suppressed: true }
  assert.equal(shouldShowMoment(s, once), false)
  assert.equal(shouldShowMoment(s, repeating), false)
})

test('a once-only moment never shows after it was seen', () => {
  assert.equal(shouldShowMoment(withOutcome({ save: 'seen' }), once), false)
})

test('a repeating moment shows again after seen, never after hidden', () => {
  assert.equal(shouldShowMoment(withOutcome({ publish: 'seen' }), repeating), true)
  assert.equal(shouldShowMoment(withOutcome({ publish: 'hidden' }), repeating), false)
  assert.equal(shouldShowMoment(withOutcome({ save: 'hidden' }), once), false)
})

test('nothing shows twice in one visit', () => {
  assert.equal(shouldShowMoment(emptyOnboardingState(), repeating, new Set(['publish'])), false)
  assert.equal(shouldShowMoment(emptyOnboardingState(), repeating, new Set(['save'])), true)
})

test('closing records seen for a once-only moment, nothing for an unticked repeating one, hidden when ticked', () => {
  assert.equal(momentOutcome(once, false), 'seen')
  assert.equal(momentOutcome(once, true), 'hidden')
  assert.equal(momentOutcome(repeating, false), undefined)
  assert.equal(momentOutcome(repeating, true), 'hidden')
})

test('hidden is final: a later seen never downgrades it', () => {
  const hidden = withOutcome({ save: 'hidden' })
  assert.equal(withMomentOutcome(hidden, 'save', 'seen'), hidden)
  assert.deepEqual(withMomentOutcome(withOutcome({ save: 'seen' }), 'save', 'hidden').moments, { save: 'hidden' })
  assert.deepEqual(withMomentOutcome(emptyOnboardingState(), 'publish', 'seen').moments, { publish: 'seen' })
})

test('paragraphs: a string splits on blank lines, an array passes through, blanks drop', () => {
  assert.deepEqual(momentParagraphs('One.\n\nTwo.\n  \nThree.'), ['One.', 'Two.', 'Three.'])
  assert.deepEqual(momentParagraphs(['A', ' ', 'B ']), ['A', 'B'])
})

test('findMoment matches own ids only', () => {
  assert.equal(findMoment([once, repeating], 'publish'), repeating)
  assert.equal(findMoment([once], 'nope'), undefined)
  assert.equal(findMoment([once], 42), undefined)
})

test('parse keeps valid outcomes and drops the rest', () => {
  const s = parseOnboardingState(JSON.stringify({ moments: { save: 'hidden', publish: 'seen', x: 'maybe', y: 1 } }))
  assert.deepEqual(s.moments, { save: 'hidden', publish: 'seen' })
  assert.deepEqual(parseOnboardingState(JSON.stringify({ moments: 'bad' })).moments, {})
  assert.deepEqual(parseOnboardingState(null).moments, {})
})

test('the local store records a moment in the same persisted record and notifies subscribers', async () => {
  const mem = new Map<string, string>()
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
  const store = createLocalOnboardingStore({ product: 'toudai', userKey: 'u1', storage })
  const heard: OnboardingState[] = []
  store.subscribe?.((s) => heard.push(s))
  await store.completeStep('first-post')
  const s = await store.recordMoment!('save', 'hidden')
  assert.deepEqual(s.moments, { save: 'hidden' })
  assert.deepEqual(s.completed, ['first-post'])
  assert.equal(heard.at(-1)?.moments?.save, 'hidden')
  const reread = createLocalOnboardingStore({ product: 'toudai', userKey: 'u1', storage })
  assert.deepEqual((await reread.load()).moments, { save: 'hidden' })
  // A second user on the same browser is untouched.
  const other = createLocalOnboardingStore({ product: 'toudai', userKey: 'u2', storage })
  assert.deepEqual((await other.load()).moments, {})
})

// A press outside the explainer card closes it and passes through to the page (toudai F16: the Save explainer's
// scrim swallowed the first Publish click). Inside the card never closes; no card mounted never closes.
test('isOutsideCard: outside closes, inside does not, no card never does', () => {
  const inside = { id: 'inside' }
  const card = { contains: (n: never) => (n as unknown) === inside }
  assert.equal(isOutsideCard({ id: 'publish-button' }, card), true)
  assert.equal(isOutsideCard(inside, card), false)
  assert.equal(isOutsideCard({ id: 'x' }, null), false)
  assert.equal(isOutsideCard(null, card), true)
})

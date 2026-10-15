// The coach-mark card placement: below when it fits, above otherwise, centered with no target, and always
// clamped inside the viewport (phone widths included).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeTourCard, TOUR_GAP, TOUR_MARGIN } from './tourPlacement.js'

const card = { width: 300, height: 150 }
const desktop = { width: 1280, height: 800 }

test('below the target when there is room, centered on it', () => {
  const p = placeTourCard({ top: 100, left: 500, width: 100, height: 40 }, card, desktop)
  assert.equal(p.side, 'below')
  assert.equal(p.top, 140 + TOUR_GAP)
  assert.equal(p.left, 550 - 150)
})

test('above when the target is near the bottom', () => {
  const p = placeTourCard({ top: 700, left: 500, width: 100, height: 40 }, card, desktop)
  assert.equal(p.side, 'above')
  assert.equal(p.top, 700 - TOUR_GAP - 150)
})

test('clamped to the viewport edge on a phone', () => {
  const phone = { width: 375, height: 812 }
  const p = placeTourCard({ top: 50, left: 340, width: 30, height: 30 }, card, phone)
  assert.equal(p.left, 375 - 300 - TOUR_MARGIN)
  const q = placeTourCard({ top: 50, left: 0, width: 30, height: 30 }, card, phone)
  assert.equal(q.left, TOUR_MARGIN)
})

test('no target: centered', () => {
  const p = placeTourCard(null, card, desktop)
  assert.equal(p.side, 'center')
  assert.equal(p.left, (1280 - 300) / 2)
  assert.equal(p.top, (800 - 150) / 2)
})

test('a tall target that leaves no room either side stays on screen', () => {
  const p = placeTourCard({ top: 20, left: 100, width: 200, height: 760 }, card, desktop)
  assert.ok(p.top >= TOUR_MARGIN && p.top + 150 <= 800 - TOUR_MARGIN)
})

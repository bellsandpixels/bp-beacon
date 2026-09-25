// The tour's Tab trap: focus wraps around the card's controls in both directions and never walks out onto
// the page under the scrim.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trapFocusTarget } from './tourFocus.js'

test('Tab on the last control wraps to the first', () => {
  assert.equal(trapFocusTarget(3, 4, false), 0)
})

test('Shift+Tab on the first control wraps to the last', () => {
  assert.equal(trapFocusTarget(0, 4, true), 3)
})

test('moves between inner controls are left to the browser', () => {
  assert.equal(trapFocusTarget(1, 4, false), null)
  assert.equal(trapFocusTarget(2, 4, true), null)
})

test('from the card itself (or anywhere outside the controls) Tab enters at the edge', () => {
  assert.equal(trapFocusTarget(-1, 4, false), 0)
  assert.equal(trapFocusTarget(-1, 4, true), 3)
  assert.equal(trapFocusTarget(9, 4, false), 0)
})

test('a single control keeps focus on itself both ways', () => {
  assert.equal(trapFocusTarget(0, 1, false), 0)
  assert.equal(trapFocusTarget(0, 1, true), 0)
})

test('no controls: nothing to move to', () => {
  assert.equal(trapFocusTarget(-1, 0, false), null)
})

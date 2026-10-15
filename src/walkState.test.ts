// The pure walk-state updates WalkSurfacePane uses for an optimistic write and its rollback. The rollback is the
// point: a save that fails must leave the pane showing what the server has, never a mark or flag it lost.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFlagged, startFailureMessage, withDefect, withDefects, withWalked, withoutDefects } from './walkState.js'
import type { WalkState } from './walkTypes.js'

const empty: WalkState = { walked: {}, defects: {} }

test('withWalked marks and unmarks a surface without touching the input', () => {
  const on = withWalked(empty, 'signin', true)
  assert.deepEqual(on.walked, { signin: true })
  assert.deepEqual(empty.walked, {}, 'input not mutated')
  assert.deepEqual(withWalked(on, 'signin', false).walked, {})
})

test('a failed mark rolls back to exactly the prior walked state', () => {
  const before = withWalked(empty, 'home', true)
  const optimistic = withWalked(before, 'signin', true)
  const rolledBack = withWalked(optimistic, 'signin', false)
  assert.deepEqual(rolledBack, before)
})

test('withDefect adds a flag with an empty note, and an empty note still counts as flagged', () => {
  const s = withDefect(empty, 7, '')
  assert.equal(isFlagged(s, 7), true)
  assert.equal(isFlagged(s, 8), false)
})

test('a failed flag rolls back: the flag is gone and the surface walk it implied is undone', () => {
  // Flagging a check auto-walks its surface; if the mark fails, both come off.
  const optimistic = withDefect(withWalked(empty, 'signin', true), 3, '')
  const rolledBack = withWalked(withoutDefects(optimistic, [3]), 'signin', false)
  assert.deepEqual(rolledBack, empty)
})

test('a failed clear puts the flag back with its note', () => {
  const flagged = withDefect(empty, 3, 'the button is grey')
  const cleared = withoutDefects(flagged, [3])
  assert.equal(isFlagged(cleared, 3), false)
  const restored = withDefects(cleared, [[3, 'the button is grey']])
  assert.deepEqual(restored, flagged)
})

test('unwalking a surface clears its flags, and a failed unwalk restores walked and every note', () => {
  const s: WalkState = { walked: { signin: true }, defects: { 1: 'a', 2: '' } }
  const optimistic = withoutDefects(withWalked(s, 'signin', false), [1, 2])
  assert.deepEqual(optimistic, empty)
  const restored = withDefects(withWalked(optimistic, 'signin', true), [
    [1, 'a'],
    [2, ''],
  ])
  assert.deepEqual(restored, s)
})

test('empty lists return the same object (no needless re-render)', () => {
  const s = withDefect(empty, 1, 'x')
  assert.equal(withoutDefects(s, []), s)
  assert.equal(withDefects(s, []), s)
})

test('startFailureMessage: the server error when there is one, a plain sentence otherwise', () => {
  assert.equal(startFailureMessage(new Error('You are in more than one test group')), 'You are in more than one test group')
  assert.equal(startFailureMessage(new Error('   ')), 'The walk could not be started.')
  assert.equal(startFailureMessage('nope'), 'The walk could not be started.')
  assert.equal(startFailureMessage(undefined), 'The walk could not be started.')
})

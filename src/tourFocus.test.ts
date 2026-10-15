// The tour's Tab trap: focus wraps around the card's controls in both directions and never walks out onto
// the page under the scrim. Also covers the two predicates that let a host dialog opened on top of the tour
// (the "New" dialog, a delete confirm) keep its own focus and click surface instead of the tour re-trapping
// onto itself (tdi-q4-studio-tour-overlay-scoped).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HIDDEN_DIALOG_SCOPE, hasOtherOpenDialog, isDialogShown, shouldRetrapFocus, trapFocusTarget, type DialogLike } from './tourFocus.js'

// A fake aria-modal element: shown (no hiding ancestor, renders a box), under a hiding ancestor (a closed
// AppFrame pane's aria-hidden wrapper), or not rendered at all (display:none, no client rects).
const dialog = ({ hidden = false, rects = 1 } = {}): DialogLike => ({
  closest: (selector: string) => (hidden && selector === HIDDEN_DIALOG_SCOPE ? {} : null),
  getClientRects: () => ({ length: rects }),
})

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

test('shouldRetrapFocus: focus stayed in the card, nothing to do', () => {
  assert.equal(shouldRetrapFocus(true, false), false)
})

test('shouldRetrapFocus: focus drifted onto the bare page, re-trap it', () => {
  assert.equal(shouldRetrapFocus(false, false), true)
})

test('shouldRetrapFocus: focus moved into a dialog the host opened on top, leave it alone', () => {
  assert.equal(shouldRetrapFocus(false, true), false)
})

test('shouldRetrapFocus: in-card-and-in-a-dialog is unreachable in practice, but in-card still wins', () => {
  assert.equal(shouldRetrapFocus(true, true), false)
})

test('hasOtherOpenDialog: only the tour\'s own card is an aria-modal element', () => {
  const card = dialog()
  assert.equal(hasOtherOpenDialog(card, [card]), false)
})

test('hasOtherOpenDialog: a second aria-modal dialog is open (the New dialog, a delete confirm)', () => {
  const card = dialog()
  const otherDialog = dialog()
  assert.equal(hasOtherOpenDialog(card, [card, otherDialog]), true)
})

test('hasOtherOpenDialog: closed panels that stay mounted (the AppFrame panes) do not stand the tour down', () => {
  const card = dialog()
  const closedPanes = [dialog({ hidden: true }), dialog({ hidden: true }), dialog({ hidden: true }), dialog({ hidden: true })]
  assert.equal(hasOtherOpenDialog(card, [...closedPanes, card]), false)
})

test('hasOtherOpenDialog: an open dialog still counts among closed panels', () => {
  const card = dialog()
  assert.equal(hasOtherOpenDialog(card, [dialog({ hidden: true }), card, dialog()]), true)
})

test('isDialogShown: a hiding ancestor or no rendered box means closed', () => {
  assert.equal(isDialogShown(dialog()), true)
  assert.equal(isDialogShown(dialog({ hidden: true })), false)
  assert.equal(isDialogShown(dialog({ rects: 0 })), false)
})

test('hasOtherOpenDialog: no dialogs at all', () => {
  assert.equal(hasOtherOpenDialog(null, []), false)
})

test('hasOtherOpenDialog: the tour has not mounted a card yet, but a dialog is already open', () => {
  assert.equal(hasOtherOpenDialog(null, [dialog()]), true)
})

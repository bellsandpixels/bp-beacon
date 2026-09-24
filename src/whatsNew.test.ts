// What's new since your last visit: opens once per upgrade with only the unseen entries; never on a first
// visit, a same-version reload, or a downgrade.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, parseVersion, whatsNewSinceLastVisit } from './whatsNew.js'

const log = [
  { version: '0.5.1900', title: 'newest' },
  { version: '0.5.1880', title: 'middle' },
  { version: '0.5.1865', title: 'seen' },
  { version: '0.4.1700', title: 'old' },
]

test('first visit: nothing opens, flagged as first visit', () => {
  assert.deepEqual(whatsNewSinceLastVisit(log, '0.5.1900', undefined), { entries: [], shouldOpen: false, firstVisit: true })
})

test('upgrade: opens with only the entries newer than last seen, in order', () => {
  const r = whatsNewSinceLastVisit(log, '0.5.1900', '0.5.1865')
  assert.equal(r.shouldOpen, true)
  assert.deepEqual(
    r.entries.map((e) => e.title),
    ['newest', 'middle'],
  )
})

test('entries ahead of the running version (a changelog written before deploy) are not shown', () => {
  const r = whatsNewSinceLastVisit(log, '0.5.1880', '0.5.1865')
  assert.deepEqual(
    r.entries.map((e) => e.title),
    ['middle'],
  )
})

test('same version or downgrade: nothing opens', () => {
  assert.equal(whatsNewSinceLastVisit(log, '0.5.1865', '0.5.1865').shouldOpen, false)
  assert.equal(whatsNewSinceLastVisit(log, '0.4.1700', '0.5.1865').shouldOpen, false)
})

test('an upgrade with no matching entries does not interrupt', () => {
  assert.equal(whatsNewSinceLastVisit([{ version: 'Unreleased' }], '1.1.0', '1.0.0').shouldOpen, false)
})

test('unparseable versions never open', () => {
  assert.equal(whatsNewSinceLastVisit(log, 'dev', '0.5.1865').shouldOpen, false)
})

test('version compare: numeric, v-prefix, suffix ignored, missing parts are zero', () => {
  assert.equal(compareVersions('0.5.10', '0.5.9'), 1)
  assert.equal(compareVersions('v1.2', '1.2.0'), 0)
  assert.equal(compareVersions('1.2.3-beta.1', '1.2.3'), 0)
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
  assert.equal(compareVersions('x', '1.0'), null)
  assert.deepEqual(parseVersion('1.2 (21)'), [1, 2])
})

// The assume-pass verdict rules, the heart of the walk. Kept in step with the bp-qa record model:
// pass by silence, a flag counts only with a non-empty note, a blocker floor outranks everything, and
// NOT WALKED is never a silent pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveVerdict } from './walkVerdict.js'
import type { ValidationCatalogue, WalkState } from './walkTypes.js'

const cat: ValidationCatalogue = {
  catalogueId: 'test',
  target: 'http://x/start',
  areas: [
    { title: 'A', surfaces: [{ key: 's1', title: 'S1', checks: [{ n: 1, text: 'a' }, { n: 2, text: 'b', severity: 'blocker' }] }] },
    { title: 'B', surfaces: [{ key: 's2', title: 'S2', checks: [{ n: 3, text: 'c' }] }] },
  ],
}
const st = (walked: Record<string, boolean>, defects: Record<number, string>): WalkState => ({ walked, defects })

test('no surface walked => NOT REVIEWED', () => {
  const v = deriveVerdict(cat, st({}, {}))
  assert.equal(v.label, 'NOT REVIEWED')
  assert.equal(v.walked, 0)
  assert.equal(v.total, 2)
})

test('all walked, nothing flagged => PASS (pass by silence)', () => {
  const v = deriveVerdict(cat, st({ s1: true, s2: true }, {}))
  assert.equal(v.label, 'PASS')
  assert.equal(v.defects, 0)
})

test('some walked, clean => INCOMPLETE, names the unwalked', () => {
  const v = deriveVerdict(cat, st({ s1: true }, {}))
  assert.equal(v.label, 'INCOMPLETE')
  assert.match(v.line, /1 surface went unjudged/)
})

test('a flag with an EMPTY note is in-progress, not a defect', () => {
  const v = deriveVerdict(cat, st({ s1: true, s2: true }, { 1: '   ' }))
  assert.equal(v.defects, 0)
  assert.equal(v.label, 'PASS')
})

test('a debt-floor defect with a note => FAIL, not blocked', () => {
  const v = deriveVerdict(cat, st({ s1: true, s2: true }, { 1: 'wrong' }))
  assert.equal(v.label, 'FAIL')
  assert.equal(v.defects, 1)
  assert.equal(v.blockers, 0)
})

test('a blocker-floor defect with a note => BLOCKED, outranks coverage', () => {
  const v = deriveVerdict(cat, st({ s1: true }, { 2: 'gate broken' }))
  assert.equal(v.label, 'BLOCKED')
  assert.equal(v.blockers, 1)
  assert.match(v.line, /Do not ship/)
})

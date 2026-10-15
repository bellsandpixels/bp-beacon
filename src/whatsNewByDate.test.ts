// What's new keyed by the entry date, for a changelog whose top heading's version is restamped on every
// deploy (client-portal): the label moves, the note does not, so only a new DATE reopens the panel.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newestEntryDate, whatsNewSinceLastVisitByDate } from './whatsNew.js'

// The portal's log after a deploy: the top heading was 1.0.2902 yesterday and is 1.0.2915 today, same note.
const log = [
  { version: '1.0.2915', date: '2026-09-05', title: 'one point oh' },
  { version: '0.5.2513', date: '2026-07-25', title: 'digest' },
  { version: '0.5.816', date: '2026-07-15', title: 'deliverables' },
]

test('first visit: nothing opens, flagged as first visit', () => {
  assert.deepEqual(whatsNewSinceLastVisitByDate(log, '2026-09-05', undefined), {
    entries: [],
    shouldOpen: false,
    firstVisit: true,
  })
})

test('a restamped top heading (same date, new version) does not reopen What\'s new', () => {
  const r = whatsNewSinceLastVisitByDate(log, '2026-09-05', '2026-09-05')
  assert.equal(r.shouldOpen, false)
  assert.deepEqual(r.entries, [])
})

test('a note with a new date opens once with only that note, carrying its real version label', () => {
  const withNew = [{ version: '1.0.2950', date: '2026-09-26', title: 'what changed' }, ...log]
  const r = whatsNewSinceLastVisitByDate(withNew, '2026-09-26', '2026-09-05')
  assert.equal(r.shouldOpen, true)
  assert.deepEqual(
    r.entries.map((e) => [e.title, e.version]),
    [['what changed', '1.0.2950']],
  )
})

test('entries newer than the seen date but not past the current one are the window; an undated entry is never new', () => {
  const mixed = [
    { version: '1.0.3000', date: '2026-10-01', title: 'future' },
    { version: '1.0.2950', date: '2026-09-26', title: 'today' },
    { version: '1.0.2940', title: 'undated' },
    ...log,
  ]
  const r = whatsNewSinceLastVisitByDate(mixed, '2026-09-26', '2026-09-05')
  assert.deepEqual(
    r.entries.map((e) => e.title),
    ['today'],
  )
})

test('a prose date is no date: nothing compares, nothing opens', () => {
  const prose = [{ version: '1.0.2950', date: 'September 26, 2026', title: 'prose' }, ...log]
  assert.equal(newestEntryDate(prose), '2026-09-05')
  assert.equal(whatsNewSinceLastVisitByDate(prose, 'September 26, 2026', '2026-09-05').shouldOpen, false)
})

test('newestEntryDate takes the newest ISO date even when the log is not sorted', () => {
  assert.equal(newestEntryDate([...log].reverse()), '2026-09-05')
  assert.equal(newestEntryDate([{ version: '1.0.0' }]), undefined)
})

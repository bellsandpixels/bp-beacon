import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareBuildsDesc, groupAssignments } from './walkList.js'

test('builds sort newest first, numerically (2.7.10 is newer than 2.7.9)', () => {
  const builds = ['2.7.6.13', '2.7.10.1', '2.7.7.14', '2.7.9.2']
  assert.deepEqual([...builds].sort(compareBuildsDesc), ['2.7.10.1', '2.7.9.2', '2.7.7.14', '2.7.6.13'])
})

test('an in-progress walk leads, and the rest group by build, newest build first', () => {
  const a = (id: string, build: string, status = 'published') => ({ id, catalogueId: id, build, env: 'prod', status })
  const todo = groupAssignments([
    a('console', '2.7.7.14'),
    a('prospect-journey', '2.7.6.13', 'in_progress'),
    a('trial-site', '2.7.7.14'),
    a('brand-kit', '2.7.6.13'),
  ])
  assert.deepEqual(todo.inProgress.map((x) => x.id), ['prospect-journey'])
  assert.deepEqual(todo.groups.map((g) => g.build), ['2.7.7.14', '2.7.6.13'])
  assert.deepEqual(todo.groups[0].assignments.map((x) => x.id), ['console', 'trial-site'])
  assert.deepEqual(todo.groups[1].assignments.map((x) => x.id), ['brand-kit'])
})

test('no assignments gives an empty list, not an error', () => {
  assert.deepEqual(groupAssignments([]), { inProgress: [], groups: [] })
})

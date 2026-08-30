// createWalkAdapter contract: it maps the WalkAdapter interface onto the /api/walk/* endpoints, tracks the
// walkId across start -> action -> submit, and refuses actions before start(). Uses a mock fetch (no network).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWalkAdapter } from './walkClient.js'

type Call = { url: string; method: string; body: unknown }

function mockFetch(routes: Record<string, unknown>) {
  const calls: Call[] = []
  const impl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url: String(url), method, body })
    const key = `${method} ${new URL(url, 'http://x').pathname}`
    const payload = routes[key] ?? {}
    return { ok: true, status: 200, json: async () => payload } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, calls }
}

const base = {
  endpoint: '/api/walk',
  cohortId: '11111111-1111-1111-1111-111111111111',
  catalogueId: 'trial-wizard',
  build: '0.5.1900',
  env: 'uat',
  total: 4,
  resolveIdentity: async () => ({ authenticated: true, name: 'Priya' }),
}

test('start posts the walk context, returns state, and tracks the walkId', async () => {
  const { impl, calls } = mockFetch({
    'POST /api/walk/start': { walkId: 'w-1', walked: { signin: true }, defects: { 2: 'broken' } },
  })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  const state = await a.start()
  assert.deepEqual(state.walked, { signin: true })
  assert.deepEqual(state.defects, { 2: 'broken' })
  const start = calls.find((c) => c.url.endsWith('/start'))!
  assert.equal(start.method, 'POST')
  assert.equal((start.body as { cohortId: string }).cohortId, base.cohortId)
  assert.equal((start.body as { catalogueId: string }).catalogueId, 'trial-wizard')
  assert.equal((start.body as { total: number }).total, 4)
})

test('markWalked / flag / clearFlag / submit carry the tracked walkId', async () => {
  const { impl, calls } = mockFetch({
    'POST /api/walk/start': { walkId: 'w-9' },
    'POST /api/walk/flag': { id: 'i-1', reference: 'INT-0042' },
    'POST /api/walk/submit': { walkId: 'w-9', coverage: { walked: 3, total: 4 }, flagged: 1, submittedOn: 'now' },
  })
  const a = createWalkAdapter({ ...base, fetchImpl: impl, titleForCheck: (n) => `Check ${n} text` })
  await a.start()
  await a.markWalked('signin', true)
  const flag = await a.flag({ checkRef: 2, note: 'broken' })
  await a.clearFlag(3)
  const summary = await a.submit()

  assert.equal(flag.reference, 'INT-0042')
  assert.equal(summary.coverage.walked, 3)
  assert.equal(summary.flagged, 1)
  for (const path of ['/mark', '/flag', '/clear', '/submit']) {
    const call = calls.find((c) => c.url.endsWith(path))!
    assert.equal((call.body as { walkId: string }).walkId, 'w-9', `${path} carries walkId`)
  }
  // flag sends the resolved title + the note
  const flagCall = calls.find((c) => c.url.endsWith('/flag'))!
  assert.equal((flagCall.body as { title: string }).title, 'Check 2 text')
  assert.equal((flagCall.body as { note: string }).note, 'broken')
})

test('an action before start() throws (no walkId)', async () => {
  const { impl } = mockFetch({})
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  await assert.rejects(() => a.markWalked('signin', true), /start\(\) must be called/)
})

test('listMine / listMyIssues map the portal shapes', async () => {
  const { impl } = mockFetch({
    'GET /api/walk/mine': { walks: [{ walkId: 'w-1', build: '0.5.1900', env: 'uat', coverage: { walked: 4, total: 4 }, flagged: 0 }] },
    'GET /api/walk/issues': { issues: [{ id: 'i-1', reference: 'INT-0042', checkRef: 2, title: 'x', status: 'routed', build: '0.5.1900' }] },
  })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  const mine = await a.listMine()
  const issues = await a.listMyIssues()
  assert.equal(mine[0].coverage.total, 4)
  assert.equal(issues[0].reference, 'INT-0042')
  assert.equal(issues[0].status, 'routed')
})

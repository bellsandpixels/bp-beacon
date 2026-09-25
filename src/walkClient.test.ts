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

test('identity() probes the ORIGIN-ABSOLUTE identity endpoint, not <base>/api/me', async () => {
  const { impl, calls } = mockFetch({
    'GET /api/me': { authenticated: true, name: 'Priya' },
  })
  // No resolveIdentity: the adapter probes identityEndpoint (default /api/me) directly. It must fetch
  // "/api/me", NOT "<base>/api/me" (= "/api/walk/api/me", which the forwarder 404s -> always unauthenticated).
  const a = createWalkAdapter({ endpoint: '/api/walk', cohortId: base.cohortId, catalogueId: 'trial-wizard', fetchImpl: impl })
  const id = await a.identity()
  assert.equal(id.authenticated, true)
  assert.equal(id.name, 'Priya')
  const call = calls.find((c) => c.url.includes('/api/me'))
  assert.ok(call, 'fetched the identity endpoint')
  assert.equal(new URL(call!.url, 'http://x').pathname, '/api/me', 'origin-absolute, not /api/walk/api/me')
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

test('current() reads the in-progress walk for THIS catalogue and maps it', async () => {
  const { impl, calls } = mockFetch({
    'GET /api/walk/current': { inProgress: { walkId: 'w-7', build: '0.5.1900', env: 'uat', coverage: { walked: 2, total: 4 }, flagged: 1 } },
  })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  const ip = await a.current()
  assert.ok(ip, 'returns the in-progress walk')
  assert.equal(ip!.walkId, 'w-7')
  assert.equal(ip!.coverage.walked, 2)
  assert.equal(ip!.coverage.total, 4)
  assert.equal(ip!.flagged, 1)
  // It is a READ (GET), and it carries the catalogueId so the server scopes to the right catalogue.
  const call = calls.find((c) => c.url.includes('/current'))!
  assert.equal(call.method, 'GET')
  assert.equal(new URL(call.url, 'http://x').searchParams.get('catalogueId'), 'trial-wizard')
})

test('current() returns null when nothing is under way', async () => {
  const { impl } = mockFetch({ 'GET /api/walk/current': { inProgress: null } })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  assert.equal(await a.current(), null)
})

// ---- B2: assignment-aware start ----

test('start(opts) launches a SPECIFIC assignment: sends assignmentId + the catalogue override (B2)', async () => {
  const { impl, calls } = mockFetch({ 'POST /api/walk/start': { walkId: 'w-2', walked: {}, defects: {} } })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  await a.start({ assignmentId: 'a-guid', catalogueId: 'trial-access', build: '0.5.2049', total: 7 })
  const body = calls.find((c) => c.url.endsWith('/start'))!.body as Record<string, unknown>
  assert.equal(body.assignmentId, 'a-guid')
  assert.equal(body.catalogueId, 'trial-access') // the ASSIGNMENT's catalogue, not the adapter default
  assert.equal(body.build, '0.5.2049')
  assert.equal(body.total, 7)
})

test('start() with no opts sends NO assignmentId and the adapter default context (unchanged, B2)', async () => {
  const { impl, calls } = mockFetch({ 'POST /api/walk/start': { walkId: 'w-3', walked: {}, defects: {} } })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  await a.start()
  const body = calls.find((c) => c.url.endsWith('/start'))!.body as Record<string, unknown>
  assert.ok(!('assignmentId' in body), 'no assignmentId on a plain start')
  assert.equal(body.catalogueId, 'trial-wizard') // the adapter default
})

// ---- Slice 4c: listAssigned ----

test('listAssigned maps GET /available to the assignment summaries (Slice 4c)', async () => {
  const { impl, calls } = mockFetch({
    'GET /api/walk/available': {
      assignments: [{ id: 'a-1', catalogueId: 'trial-access', build: '0.5.2049', env: 'prod', ring: 0, status: 'published' }],
    },
  })
  const a = createWalkAdapter({ ...base, fetchImpl: impl })
  const assigned = await a.listAssigned!()
  assert.equal(assigned.length, 1)
  assert.equal(assigned[0].id, 'a-1')
  assert.equal(assigned[0].catalogueId, 'trial-access')
  assert.equal(assigned[0].build, '0.5.2049')
  assert.equal(assigned[0].env, 'prod')
  assert.equal(assigned[0].status, 'published')
  assert.equal(calls.find((c) => c.url.includes('/available'))!.method, 'GET')
})

// Re-upstreamed from client-portal's copy (client-portal #641, decision #143): a resolved issue carries the
// reporter-safe resolution note and whether it was a code fix or a clarification.
test('listMyIssues maps resolution + resolutionKind (Fixed vs Clarified) from the portal row', async () => {
  const { impl } = mockFetch({
    'GET /api/walk/issues': {
      issues: [
        { id: 'i-1', reference: 'INT-0042', checkRef: 2, title: 'x', status: 'closed', build: '0.5.1900', resolvedBuild: '0.5.1910', resolution: 'Widened the hit target', resolutionKind: 'fixed' },
        { id: 'i-2', reference: 'INT-0043', checkRef: 3, title: 'y', status: 'closed', build: '0.5.1900', resolvedBuild: '0.5.1910', resolution: 'By design: the badge hides on prod', resolutionKind: 'clarified' },
      ],
    },
  })
  const issues = await createWalkAdapter({ ...base, fetchImpl: impl }).listMyIssues()
  assert.equal(issues[0].resolution, 'Widened the hit target')
  assert.equal(issues[0].resolutionKind, 'fixed')
  assert.equal(issues[1].resolutionKind, 'clarified')
  assert.equal(issues[1].resolvedBuild, '0.5.1910')
})

// Re-upstreamed from client-portal's copy (client-portal #752, decision #155 slice 3): the walk's device
// platform rides start() ONLY when the host set it, so an unchanged caller sends the previous request.
test('start() sends platform only when the host set it', async () => {
  const withP = mockFetch({ 'POST /api/walk/start': { walkId: 'w-1' } })
  await createWalkAdapter({ ...base, platform: 'ios', fetchImpl: withP.impl }).start()
  const started = withP.calls.find((c) => c.url.endsWith('/start'))!
  assert.equal((started.body as { platform?: string }).platform, 'ios')

  const without = mockFetch({ 'POST /api/walk/start': { walkId: 'w-2' } })
  await createWalkAdapter({ ...base, fetchImpl: without.impl }).start()
  const plain = without.calls.find((c) => c.url.endsWith('/start'))!
  assert.equal('platform' in (plain.body as object), false)
})

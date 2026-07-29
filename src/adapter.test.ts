// Contract test (SDK side): buildEnvelope must produce EXACTLY the /api/beacon-signal envelope the server
// accepts - the canonical field set (product, kind, title, details, consent, clientReportId, hp, context?),
// with context gated on consent [D3] and the honeypot always empty. The server-side half of this contract
// (that beacon-signal accepts exactly this set) is pinned by a matching test in the client-portal repo.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEnvelope, type BeaconAdapterConfig } from './adapter.js'

const cfg: BeaconAdapterConfig = {
  endpoint: '/api/feedback',
  product: 'toudai',
  appName: 'Toudai Studio',
  appVersion: '0.1.0',
  env: 'production',
}

// The exact set of keys /api/beacon-signal accepts (docs/beacon-anon-ingest-spec.md). buildEnvelope must
// never emit a key outside this set (a stray key could carry un-allow-listed data past the D3 boundary).
const ALLOWED_KEYS = new Set(['product', 'kind', 'title', 'details', 'consent', 'clientReportId', 'hp', 'context'])

test('envelope carries the canonical fields, product stamped, honeypot empty', () => {
  const e = buildEnvelope(cfg, { kind: 'bug', title: 'x', details: 'y', consent: false })
  assert.equal(e.product, 'toudai')
  assert.equal(e.kind, 'bug')
  assert.equal(e.title, 'x')
  assert.equal(e.details, 'y')
  assert.equal(e.consent, false)
  assert.equal(e.hp, '') // honeypot always empty from a real client
})

test('no key escapes the allow-list (the D3 boundary)', () => {
  for (const consent of [true, false]) {
    const e = buildEnvelope(cfg, { kind: 'idea', title: 't', details: 'd', consent })
    for (const k of Object.keys(e)) assert.ok(ALLOWED_KEYS.has(k), `unexpected envelope key: ${k}`)
  }
})

test('context is gated on consent [D3]: present only when consent === true', () => {
  const off = buildEnvelope(cfg, { kind: 'bug', title: 't', details: 'd', consent: false })
  assert.equal(off.context, undefined)

  const on = buildEnvelope(cfg, { kind: 'bug', title: 't', details: 'd', consent: true })
  assert.ok(on.context, 'consent=true must attach context')
  // Allow-list only: exactly the client-safe fields, nothing that could join back to a person/device.
  assert.deepEqual(
    Object.keys(on.context!).sort(),
    ['appName', 'appVersion', 'env', 'locale', 'osMajor', 'platform', 'route'],
  )
  assert.equal(on.context!.appName, 'Toudai Studio')
  assert.equal(on.context!.platform, 'web')
})

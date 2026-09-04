// Contract test (SDK side): buildEnvelope must produce EXACTLY the /api/beacon-signal envelope the server
// accepts - the canonical field set (product, kind, title, details, consent, clientReportId, hp, context?,
// contact?), with context gated on consent [D3] and the honeypot always empty. The server-side half of this
// contract (that beacon-signal accepts exactly this set) is pinned by a matching test in the client-portal
// repo; keep that repo's SDK_ENVELOPE_KEYS in lockstep with ALLOWED_KEYS below.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEnvelope, type BeaconAdapterConfig } from './adapter.js'
import { deviceFromUA, osFromUA, osMajorFromUA } from './diagnostics.js'

const cfg: BeaconAdapterConfig = {
  endpoint: '/api/feedback',
  product: 'toudai',
  appName: 'Toudai Studio',
  appVersion: '0.1.0',
  env: 'production',
}

// The exact set of keys /api/beacon-signal accepts (docs/beacon-anon-ingest-spec.md). buildEnvelope must
// never emit a key outside this set (a stray key could carry un-allow-listed data past the D3 boundary).
// `contact` is the optional, explicit reporter identity (bp_contact, never auto-derived).
const ALLOWED_KEYS = new Set(['product', 'kind', 'title', 'details', 'consent', 'clientReportId', 'hp', 'context', 'contact'])

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
    ['appName', 'appVersion', 'device', 'env', 'locale', 'os', 'osMajor', 'platform', 'route'],
  )
  assert.equal(on.context!.appName, 'Toudai Studio')
  assert.equal(on.context!.platform, 'web')
})

// Reporter identity (R6): `contact` rides only when explicit, trimmed + capped, and the reporter's value
// (including an explicit '' to clear) always beats a host-configured resolveIdentity fallback.
const withIdentity: BeaconAdapterConfig = { ...cfg, resolveIdentity: () => 'user@host.example' }

test('no contact anywhere: the contact key is absent', () => {
  const e = buildEnvelope(cfg, { kind: 'bug', title: 't', details: 'd', consent: false })
  assert.equal('contact' in e, false)
})

test('a reporter-typed contact rides as `contact`, trimmed and capped at 200', () => {
  const e = buildEnvelope(cfg, { kind: 'bug', title: 't', details: 'd', consent: false, contact: '  me@example.com  ' })
  assert.equal(e.contact, 'me@example.com')
  const e2 = buildEnvelope(cfg, { kind: 'bug', title: 't', details: 'd', consent: false, contact: 'a'.repeat(250) })
  assert.equal(e2.contact!.length, 200)
})

test('host identity (resolveIdentity) fills contact when the caller omits the field', () => {
  const e = buildEnvelope(withIdentity, { kind: 'bug', title: 't', details: 'd', consent: false })
  assert.equal(e.contact, 'user@host.example')
})

test('a typed contact wins over the host identity', () => {
  const e = buildEnvelope(withIdentity, { kind: 'bug', title: 't', details: 'd', consent: false, contact: 'typed@me.example' })
  assert.equal(e.contact, 'typed@me.example')
})

test('an explicit empty contact clears it and beats the host identity fallback', () => {
  const e = buildEnvelope(withIdentity, { kind: 'bug', title: 't', details: 'd', consent: false, contact: '' })
  assert.equal('contact' in e, false)
})

test('contact never escapes the allow-list', () => {
  const e = buildEnvelope(withIdentity, { kind: 'bug', title: 't', details: 'd', consent: true, contact: 'me@example.com' })
  for (const k of Object.keys(e)) assert.ok(ALLOWED_KEYS.has(k), `unexpected envelope key: ${k}`)
})

// Coarse device/os derivation - the new form-factor + OS-family fields. Best-effort and coarse ONLY:
// unknown UAs yield '' (dropped downstream), never a raw string. Real-world UA samples per family.
const UA = {
  winDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  macDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15',
  linuxDesktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18 Mobile/15E148 Safari/604.1',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1',
  androidPhone: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
}

test('deviceFromUA: coarse form factor (phone / tablet / desktop), unknown => empty', () => {
  assert.equal(deviceFromUA(UA.winDesktop), 'desktop')
  assert.equal(deviceFromUA(UA.macDesktop), 'desktop')
  assert.equal(deviceFromUA(UA.linuxDesktop), 'desktop')
  assert.equal(deviceFromUA(UA.iPhone), 'phone')
  assert.equal(deviceFromUA(UA.androidPhone), 'phone') // Android WITH "Mobile" => phone
  assert.equal(deviceFromUA(UA.iPad), 'tablet')
  assert.equal(deviceFromUA(UA.androidTablet), 'tablet') // Android WITHOUT "Mobile" => tablet
  assert.equal(deviceFromUA(''), '')
  assert.equal(deviceFromUA(undefined), '')
})

test('osFromUA: coarse OS family, mobile families before desktop, unknown => empty', () => {
  assert.equal(osFromUA(UA.winDesktop), 'win')
  assert.equal(osFromUA(UA.macDesktop), 'mac')
  assert.equal(osFromUA(UA.linuxDesktop), 'linux')
  assert.equal(osFromUA(UA.iPhone), 'ios')
  assert.equal(osFromUA(UA.iPad), 'ios')
  assert.equal(osFromUA(UA.androidPhone), 'android') // Android UA also contains "Linux" - Android wins
  assert.equal(osFromUA(UA.androidTablet), 'android')
  assert.equal(osFromUA(''), '')
})

test('osMajor stays the version detail behind the coarse os (unchanged behaviour)', () => {
  assert.equal(osMajorFromUA(UA.iPhone), 'iOS 18')
  assert.equal(osMajorFromUA(UA.androidPhone), 'Android 15')
  assert.equal(osMajorFromUA(UA.winDesktop), 'Windows 10+')
})

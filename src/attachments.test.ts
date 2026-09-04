// Reporter attachment picker (cp-beacon-attachments): the file validator + the adapter's two-phase upload
// (mint tickets -> PUT each to blob). The upload is exercised with an injected fetch (no network).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBeaconAdapter, type BeaconAdapterConfig } from './adapter.js'
import { validateAttachmentFile, MAX_ATTACHMENT_BYTES } from './attachments.js'

const cfg: BeaconAdapterConfig = {
  endpoint: '/api/feedback',
  ticketEndpoint: '/api/feedback-attachment-ticket',
  product: 'toudai',
  appName: 'Toudai Studio',
  appVersion: '0.1.0',
  env: 'production',
}

function png(name = 'a.png', size = 1000): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' })
}

test('validateAttachmentFile: allow-list + 10 MB cap', () => {
  assert.equal(validateAttachmentFile({ type: 'image/png', size: 100 }), null)
  assert.equal(validateAttachmentFile({ type: 'image/jpeg', size: 100 }), null)
  assert.equal(validateAttachmentFile({ type: 'image/webp', size: 100 }), null)
  assert.ok(validateAttachmentFile({ type: 'image/gif', size: 100 })) // not allow-listed
  assert.ok(validateAttachmentFile({ type: 'application/pdf', size: 100 }))
  assert.ok(validateAttachmentFile({ type: 'image/png', size: MAX_ATTACHMENT_BYTES + 1 })) // over cap
})

test('no ticketEndpoint => the adapter exposes no uploadAttachments', () => {
  const a = createBeaconAdapter({ ...cfg, ticketEndpoint: undefined })
  assert.equal(a.uploadAttachments, undefined)
})

test('uploadAttachments: tickets -> PUTs -> refs, sharing one clientReportId', async () => {
  let ticketBody: { clientReportId?: string; files?: unknown[] } = {}
  let puts = 0
  const fetchImpl = (async (url: unknown, init: { method?: string; body?: string } = {}) => {
    if (String(url).includes('ticket')) {
      ticketBody = JSON.parse(init.body ?? '{}')
      const tickets = (ticketBody.files ?? []).map((_v, i) => ({ attachmentId: `id-${i}`, url: `https://blob/put/${i}` }))
      return new Response(JSON.stringify({ tickets }), { status: 200 })
    }
    puts++
    return new Response('', { status: 201 }) // blob PUT ok
  }) as unknown as typeof fetch

  const a = createBeaconAdapter({ ...cfg, fetchImpl })
  const res = await a.uploadAttachments!([png('a.png'), png('b.png')])

  assert.match(res.clientReportId, /^[0-9a-fA-F-]{36}$/)
  assert.equal(ticketBody.clientReportId, res.clientReportId) // the ticket used the shared id
  assert.deepEqual(res.attachments.map((x) => x.id), ['id-0', 'id-1'])
  assert.deepEqual(res.attachments[0], { id: 'id-0', contentType: 'image/png', bytes: 1000 })
  assert.equal(puts, 2)
})

test('uploadAttachments: a failed PUT is skipped, never thrown', async () => {
  const fetchImpl = (async (url: unknown) => {
    if (String(url).includes('ticket')) {
      return new Response(JSON.stringify({ tickets: [{ attachmentId: 'id-0', url: 'https://blob/0' }, { attachmentId: 'id-1', url: 'https://blob/1' }] }), { status: 200 })
    }
    if (String(url).endsWith('/1')) return new Response('', { status: 403 }) // second upload fails
    return new Response('', { status: 201 })
  }) as unknown as typeof fetch

  const a = createBeaconAdapter({ ...cfg, fetchImpl })
  const res = await a.uploadAttachments!([png(), png()])
  assert.equal(res.attachments.length, 1) // only the first uploaded
  assert.equal(res.attachments[0].id, 'id-0')
})

test('uploadAttachments: caps at 3 files', async () => {
  const fetchImpl = (async (url: unknown, init: { body?: string } = {}) => {
    if (String(url).includes('ticket')) {
      const body = JSON.parse(init.body ?? '{}')
      return new Response(JSON.stringify({ tickets: (body.files ?? []).map((_v: unknown, i: number) => ({ attachmentId: `id-${i}`, url: `https://blob/${i}` })) }), { status: 200 })
    }
    return new Response('', { status: 201 })
  }) as unknown as typeof fetch

  const a = createBeaconAdapter({ ...cfg, fetchImpl })
  const res = await a.uploadAttachments!([png(), png(), png(), png(), png()])
  assert.equal(res.attachments.length, 3)
})

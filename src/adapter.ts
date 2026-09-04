// The canonical Beacon submit adapter. Builds the /api/beacon-signal envelope and POSTs it to a
// host-supplied endpoint (a same-origin forwarder for web, or the portal endpoint directly). Consent-gated
// auto-context [D3] rides ONLY when the reporter opts in. Submit-only + anonymous by default: no reporter
// id, so no list/confirm/reopen and the "Your reports" view stays hidden - the same envelope the native
// (Android/iOS) client sends directly. This is the ONE implementation the products converge onto.

import type { BeaconEnvelope, FeedbackAdapter } from './types.js'
import { gatherWebContext, type WebContextConfig } from './diagnostics.js'

export interface BeaconAdapterConfig extends WebContextConfig {
  // Where the envelope is POSTed. Web products use a same-origin forwarder (e.g. "/api/feedback") that
  // relays to the portal; a direct integration uses the portal endpoint (e.g.
  // "https://clientportal.bells-and-pixels.com/api/beacon-signal").
  endpoint: string
  // The product tag stamped on the envelope (e.g. "fudemoji", "toudai"). A forwarder MAY re-stamp this
  // server-side; sending it keeps the direct and forwarded paths identical.
  product: string
  // Optional host-known reporter identity, resolved FRESH at submit time (so a login/logout between
  // adapter construction and submit is reflected), returning undefined when the user is unknown/anonymous.
  // It is a FALLBACK only: a contact the caller passes to submit (a string, including an explicit '' to
  // clear) always wins. Used for direct submit callers; the FeedbackPane resolves its own prefill.
  resolveIdentity?: () => string | undefined
  // Injectable for tests; defaults to the global fetch.
  fetchImpl?: typeof fetch
}

function newClientReportId(): string | undefined {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined
}

// Build the wire envelope. Exported so a contract test can assert its shape against the server without a
// network call.
const MAX_CONTACT = 200

export function buildEnvelope(
  cfg: BeaconAdapterConfig,
  input: { kind: BeaconEnvelope['kind']; title: string; details: string; consent: boolean; contact?: string },
): BeaconEnvelope {
  const envelope: BeaconEnvelope = {
    product: cfg.product,
    kind: input.kind,
    title: input.title,
    details: input.details,
    consent: input.consent,
    clientReportId: newClientReportId(),
    hp: '',
  }
  // Reporter identity. The caller's explicit contact wins - `??` (not `||`) means an explicit '' (the
  // reporter cleared a prefilled identity) beats the host fallback, so "cleared" genuinely clears; the
  // host-known identity is consulted ONLY when the caller omitted the field entirely (contact undefined).
  // Trim + cap to 200 (bp_contact's size), and attach only when something remains.
  const contact = (input.contact ?? cfg.resolveIdentity?.() ?? '').trim().slice(0, MAX_CONTACT)
  if (contact) envelope.contact = contact
  // Consent gate [D3]: attach the allow-list context ONLY when the reporter opts in.
  if (input.consent) envelope.context = gatherWebContext(cfg)
  return envelope
}

export function createBeaconAdapter(cfg: BeaconAdapterConfig): FeedbackAdapter {
  const doFetch = cfg.fetchImpl ?? fetch
  return {
    submit: async (input) => {
      const envelope = buildEnvelope(cfg, input)
      const res = await doFetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        intakeNumber?: string | number
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Could not file the report.')
      }
      const ref = data.intakeNumber != null ? String(data.intakeNumber) : undefined
      return { id: ref ?? '', reference: ref }
    },
  }
}

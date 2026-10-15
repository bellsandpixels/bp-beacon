// The canonical Beacon submit adapter. Builds the /api/beacon-signal envelope and POSTs it to a
// host-supplied endpoint (a same-origin forwarder for web, or the portal endpoint directly). Consent-gated
// auto-context [D3] rides ONLY when the reporter opts in. Submit-only + anonymous by default: no reporter
// id, so no list/confirm/reopen and the "Your reports" view stays hidden - the same envelope the native
// (Android/iOS) client sends directly. This is the ONE implementation the products converge onto.
import { gatherWebContext } from './diagnostics.js';
import { MAX_ATTACHMENTS } from './attachments.js';
function newClientReportId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
}
// Build the wire envelope. Exported so a contract test can assert its shape against the server without a
// network call.
const MAX_CONTACT = 200;
export function buildEnvelope(cfg, input) {
    const envelope = {
        product: cfg.product,
        kind: input.kind,
        title: input.title,
        details: input.details,
        consent: input.consent,
        // When the pane uploaded attachments it already minted the id (the quarantine prefix); reuse it so the
        // envelope and the uploads share one clientReportId. Otherwise generate a fresh one.
        clientReportId: input.clientReportId ?? newClientReportId(),
        hp: '',
    };
    // Reporter identity. The caller's explicit contact wins - `??` (not `||`) means an explicit '' (the
    // reporter cleared a prefilled identity) beats the host fallback, so "cleared" genuinely clears; the
    // host-known identity is consulted ONLY when the caller omitted the field entirely (contact undefined).
    // Trim + cap to 200 (bp_contact's size), and attach only when something remains.
    const contact = (input.contact ?? cfg.resolveIdentity?.() ?? '').trim().slice(0, MAX_CONTACT);
    if (contact)
        envelope.contact = contact;
    // Attachment references (cp-beacon-attachments): pass through the already-uploaded image refs, capped at
    // MAX_ATTACHMENTS. Only when non-empty; the server re-verifies each blob (existence, size, sniffed type).
    if (input.attachments && input.attachments.length) {
        envelope.attachments = input.attachments.slice(0, MAX_ATTACHMENTS);
    }
    // Consent gate [D3]: attach the allow-list context ONLY when the reporter opts in.
    if (input.consent)
        envelope.context = gatherWebContext(cfg);
    return envelope;
}
export function createBeaconAdapter(cfg) {
    const doFetch = cfg.fetchImpl ?? fetch;
    const adapter = {
        submit: async (input) => {
            const envelope = buildEnvelope(cfg, input);
            const res = await doFetch(cfg.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(envelope),
            });
            const data = (await res.json().catch(() => ({})));
            if (!res.ok || data.ok === false) {
                throw new Error(data.error || 'Could not file the report.');
            }
            const ref = data.intakeNumber != null ? String(data.intakeNumber) : undefined;
            return { id: ref ?? '', reference: ref };
        },
    };
    // Attachments (cp-beacon-attachments): exposed ONLY when a ticket endpoint is configured. The two-phase
    // upload - mint a clientReportId, request one write-only SAS per image, PUT each straight to blob -
    // returns the shared clientReportId + the refs the pane then passes to submit. Best-effort per file: a
    // failed upload is skipped (never throws), so the report can still be filed without that image.
    if (cfg.ticketEndpoint) {
        const ticketEndpoint = cfg.ticketEndpoint;
        adapter.uploadAttachments = async (files) => {
            const clientReportId = newClientReportId();
            if (!clientReportId || !files.length)
                return { clientReportId: clientReportId ?? '', attachments: [] };
            const capped = files.slice(0, MAX_ATTACHMENTS);
            let tickets = [];
            try {
                const res = await doFetch(ticketEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientReportId, hp: '', files: capped.map((f) => ({ contentType: f.type, bytes: f.size })) }),
                });
                const data = (await res.json().catch(() => ({})));
                tickets = res.ok ? data.tickets ?? [] : [];
            }
            catch {
                return { clientReportId, attachments: [] };
            }
            const attachments = [];
            // Tickets come back in files order (the server iterates the request's files array in order).
            for (let i = 0; i < tickets.length && i < capped.length; i++) {
                const t = tickets[i];
                const f = capped[i];
                if (!t || !f)
                    continue;
                try {
                    const put = await doFetch(t.url, {
                        method: 'PUT',
                        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': f.type },
                        body: f,
                    });
                    if (put.ok)
                        attachments.push({ id: t.attachmentId, contentType: f.type, bytes: f.size });
                }
                catch {
                    // skip a failed upload; the report can still be filed
                }
            }
            return { clientReportId, attachments };
        };
    }
    return adapter;
}

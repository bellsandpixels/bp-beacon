// The two-phase image upload shared by the feedback adapter and the walk adapter (cp-beacon-attachments,
// cp-walk-flag-screenshots): mint a clientReportId, ask the ticket endpoint for one write-only SAS per
// image, PUT each image straight to blob. Returns the clientReportId (the quarantine prefix the tickets
// used) and the refs of the images that uploaded; the caller references both on its next write (the
// /api/beacon-signal envelope, or a walk flag) and the server verifies, sniffs and promotes them.
// Best-effort per file: a failed upload is skipped, never thrown, so the report or flag still saves.
import { MAX_ATTACHMENTS } from './attachments.js';
export function newClientReportId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
}
export async function uploadViaTickets(doFetch, ticketEndpoint, files) {
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
            // skip a failed upload; the write can still go through without that image
        }
    }
    return { clientReportId, attachments };
}

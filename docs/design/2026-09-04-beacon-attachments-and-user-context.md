---
title: Beacon attachments + reporter identity (design)
status: RATIFIED 2026-09-04 (owner). Build not yet started.
discipline: product-dev
track: bp-beacon (SDK) + client-portal (governing contract, decision #63)
authored: 2026-09-04
ratified: 2026-09-04
supersedes: nothing
amends-on-ratification: client-portal docs/beacon-anon-ingest-spec.md
---

# Beacon: attachments + reporter identity

Design proposal for two additions to the Beacon issue/idea pipeline:

1. **Attachments.** Let a reporter add a screenshot or a short video clip to an issue.
2. **Reporter identity.** When the host app already knows who the user is, carry that
   through, and let the reporter add or clear a contact themselves.

This document is a proposal. It builds nothing. On ratification the contract parts land in
client-portal and the SDK parts land in bp-beacon (see "Landing homes"). Read the decisions
block first: everything after it is the reasoning behind those asks.

---

## TL;DR

- **Reporter identity is nearly free.** The server contract already accepts an optional
  `contact` field (`bp_contact`, "never auto-derived"). The SDK just does not surface it. Wiring
  it through the envelope, the adapter, and the pane is a self-contained bp-beacon slice with **no
  server change**. It is independently shippable and should go first.
- **Attachments are a real cross-repo feature, and they must start in client-portal.** The wire
  envelope is a governed, contract-tested schema that the server enum-validates and rejects unknown
  fields against. Binaries need blob storage, size and type caps, malware handling on an anonymous
  endpoint, a retention policy, and an isolation review. None of that can originate in the SDK.
- **The good news: the spine already exists.** client-portal already has the exact upload pattern
  we need (`api/src/lib/blob.ts`: private container, backend-minted short-lived user-delegation SAS,
  direct browser PUT, prefix isolation), plus `beacon-ratelimit.ts` and `beacon-challenge.ts`. The
  attachment design reuses these rather than inventing anything.
- **The load-bearing decision is not technical, it is the privacy posture.** This pipeline was
  ratified as deliberately minimal: a coarse allow-list, no scraped state, structurally
  non-joinable. A screenshot or a video is a categorical increase in captured data and can contain
  arbitrary personal information. Adding it needs an explicit amendment to that ratified stance.

## Decisions you need to make (owner rulings)

| # | Decision | Recommendation |
|---|---|---|
| R1 | Amend the ratified Beacon privacy posture to allow reporter-attached binaries (images, and optionally video), under the safeguards in Part 2.1. | **Approve, with the safeguards.** Reporter-initiated only, never auto-captured, disclosed, EXIF-stripped, retention-bounded, isolation-reviewed. |
| R2 | Video in v1, or images-only first? | **Images-only for v1**; add video as a fast follow once the image path is proven. Video is the biggest jump in storage, abuse surface, and cost, and it can ride the same rails later without rework. |
| R3 | Wire format for attachments. | **Two-phase pre-signed upload** (mint ticket, browser PUTs to blob, envelope carries a small reference array). It is already the house pattern in `blob.ts`. |
| R4 | Storage + data model. | **A child table `bp_intakeattachment` + a private blob container.** Binaries in blob, references in Dataverse. No Dataverse file columns. |
| R5 | Sequencing vs the abuse-hardening residuals. | **Attachments must not reach any public/GA exposure until per-IP rate-limiting covers the ticket endpoint** (reuse `beacon-ratelimit.ts`). Binary upload raises the stakes on the already-tracked `cp-beacon-anon-ratelimit` residual. |
| R6 | Reporter identity capture mode. | **Both** (your ruling): prefill from host-known identity when available, keep it reporter-editable and clearable. |

**Ratified by the owner on 2026-09-04:** R1 approve with the safeguards; R2 images-only for v1
(video deferred, same rails later); R3 two-phase pre-signed upload; R4 child table
`bp_intakeattachment` + a private blob container; R5 no public/GA attachment exposure until per-IP
rate-limiting covers the ticket endpoint; R6 both (host-prefilled + reporter-editable). The design
below is the build contract.

Everything below supports these six asks.

---

## Context and grounding

Grounded 2026-09-04 against `origin/main` on both repos (the local client-portal clone was 214
commits behind, so the contract was read from `origin/main`, not the working tree).

**What a Beacon "issue" is.** A `FeedbackPane` submission (kind Issue or Idea) built into the
`/api/beacon-signal` envelope by `createBeaconAdapter` and POSTed to a host-supplied endpoint. The
same envelope is sent by the native KMP client. Submit-only and anonymous by default.

**The contract is governed, not ours to freely extend.** Per decision #63 the wire envelope is
canonical in client-portal `docs/beacon-anon-ingest-spec.md`, and a contract test there asserts the
SDK envelope matches what `api/src/functions/beacon-signal.ts` accepts. The server
enum-validates `kind`/`product`/`env`/`platform`, caps string sizes, and rejects unknown input. So
the SDK is strictly downstream: a field the server does not accept cannot be made to work from
bp-beacon, and adding one breaks the contract test.

**The existing server body already has an identity slot.** The ingest spec's contract body is:

```
{ clientReportId(uuid), product, kind(bug|idea), title(3..300), details(0..4000),
  consent(bool), contact?(<=200), hp(honeypot), attestation?(mobile), turnstile?(web),
  context{ appName, appVersion, env, platform, device, os, osMajor, route, locale } }
```

`contact?(<=200)` maps to a `bp_contact` column spec'd as "optional; never auto-derived." That is
the home for reporter identity. It exists server-side today and is unused by the SDK.

**The upload spine already exists.** `api/src/lib/blob.ts` implements exactly the pattern
attachments want:

- A **private** container; clients never hold storage credentials.
- The backend mints a **short-lived user-delegation SAS** with the Function app's managed identity
  (shared-key access is disabled, so this is the only path). `SasOptions` already distinguishes
  `'cw'` (create+write, upload) from `'r'` (read, download), with a TTL and content-disposition.
- The **browser PUTs directly to blob** via the minted SAS; the server stamps metadata after the
  PUT confirms.
- **Isolation is by blob-name prefix**, and endpoints only ever sign a blob under the caller's own
  namespace.

Deliverables, agreements, and status-report hardcopies all run on this. Attachments are the same
shape with a different isolation key (see Part 2.3).

**Abuse-hardening substrate exists too.** `api/src/lib/beacon-ratelimit.ts` and
`api/src/functions/beacon-challenge.ts` are present on `origin/main`, so the rate-limit and
challenge/nonce work has progressed past the ALPHA MVP stub the spec describes. The attachment
ticket endpoint reuses these seams.

---

## Part 1: reporter identity (the small, shippable slice)

Independently shippable in bp-beacon with no server change, because `contact` already rides the
contract. Goal: when the host knows the user, carry it; also let the reporter type or clear a
contact. Ruling R6 is "both," so the field is prefilled from host identity when available and stays
editable.

### 1.1 Envelope and types

Add one optional field to `BeaconEnvelope` (matches the server's existing `contact?`):

```ts
export interface BeaconEnvelope {
  // ...existing fields...
  contact?: string // optional reporter contact (<=200). Explicit, never auto-derived server-side.
}
```

Extend `FeedbackAdapter.submit`'s input and the config so identity can come from either source:

```ts
// Host-known identity, resolved fresh at submit time (not captured once), so a login/logout
// between adapter construction and submit is reflected. Returns undefined when unknown/anonymous.
export interface BeaconAdapterConfig extends WebContextConfig {
  // ...existing...
  resolveIdentity?: () => string | undefined
}

// submit input gains the reporter-entered/edited value:
submit: (input: {
  kind: FeedbackKind; title: string; details: string; consent: boolean
  contact?: string
}) => Promise<{ id: string; reference?: string }>
```

### 1.2 Merge rule in `buildEnvelope`

Precedence, then trim, cap, and only set when non-empty:

1. If the reporter typed/edited a value, that wins (they had the last word, including clearing it).
2. Else fall back to `resolveIdentity?.()` (the host-known identity).
3. `trim()`, cap to 200, and set `envelope.contact` only if the result is non-empty. Never send an
   empty string.

The reporter's explicit edit always outranks the host prefill, so "clear it" genuinely clears it.

### 1.3 Pane UI

Add an optional field below Details: label "How can we reach you? (optional)", `type="email"`
input, `maxLength=200`. Prefill from `resolveIdentity()` when the host wired it, with a light hint
that it was filled from the account and can be changed or removed. It appears in the "What's
included?" preview so the reporter sees exactly what will be sent.

### 1.4 Privacy stance for identity

This preserves the ratified posture rather than eroding it:

- **Still never server-auto-derived.** `bp_contact` is never inferred from IP or auth on the
  server. When the host passes an identity it is an explicit host choice, and prefilling discloses
  it to the reporter, who can remove it before sending. The act of leaving it in the field is the
  consent.
- **Separate from the D3 diagnostics consent.** Contact is primary content the reporter controls
  directly, not auto-context, so it does not sit behind the diagnostics checkbox. It rides based on
  the field's value alone.

### 1.5 Contract and parity notes

- No server change: `contact` is already accepted and capped at 200. Before merging, confirm the
  client-portal **contract test** treats `contact` as an accepted optional (it should, since the
  server body lists it) so the added envelope field does not trip an exact-shape assertion.
- **KMP parity:** the native envelope should mirror `contact` for consistency. Out of scope for
  this first slice; flagged as a follow-on so web and native do not drift.

---

## Part 2: attachments (the cross-repo feature)

Cannot originate in the SDK. Starts as a client-portal spec, lands server-side, then the SDK and
pane follow in lockstep with the contract test.

### 2.1 Privacy posture shift (the load-bearing decision, R1)

The pipeline was ratified as deliberately minimal: a coarse allow-list (`device`, `os`, `osMajor`,
`route`, `locale`, app identity), an explicit DENY list (no stable id, no IP on the row, no full
UA, no scraped state), and a structural non-joinability guarantee (the columns to hold that data
simply do not exist). A screenshot or a video is a different category of data. It can contain a
person's name on screen, another user's data, a visible credential, an email thread, EXIF GPS in an
image. This is not covered by the D3 allow-list ratification and needs its own owner ruling.

To keep it defensible, the amendment carries these as hard requirements, not options:

- **Reporter-initiated only.** The reporter picks the file or records the clip. There is never an
  automatic screenshot or screen capture. This is the single most important line: it keeps
  attachments consistent with "the reporter chose to share this," exactly like the title and
  details they typed.
- **Reporter-visible before send.** The pane shows a thumbnail/preview of each attachment and a
  remove control, so nothing is sent that the reporter did not see attached.
- **Disclosure copy** near the picker: "Attachments can contain personal information. Only include
  what you are comfortable sharing." Plain, not buried.
- **EXIF/metadata strip** on images at promote time (server-side), so image location and device
  metadata do not ride along silently.
- **Retention bound.** Attachments carry more than the allow-list, so they are not kept
  indefinitely. Purge on row deletion/decline, and a TTL on the raw quarantine copies. Exact policy
  is R-open below.
- **Isolation-reviewed.** The mandatory portal-isolation-review gate extends to attachments with
  the same inverted check the parent row gets: an internal-anchored attachment must be unreachable
  from any client or tester read scope.

If R1 is declined, Part 2 stops here and only Part 1 proceeds.

### 2.2 Wire format (R3)

Three candidates, evaluated against a JSON-envelope contract, an anonymous endpoint, and
video-sized payloads.

1. **Inline base64 in the envelope.** Simplest client code, but base64 inflates ~33 percent, forces
   binaries through the small-JSON validate path, and a video would blow the Function request-size
   limit. Acceptable only for tiny images. **Rejected** for a video-capable design.
2. **Multipart to the ingest endpoint.** One round trip: envelope plus file parts. But it makes the
   anonymous endpoint parse and stream binaries, complicates mid-stream size enforcement, and puts
   the large transfer through the Function. Workable, but heavier and more abuse-exposed than
   needed.
3. **Two-phase pre-signed upload (recommended).** The house pattern, already in `blob.ts`:
   1. Client calls `POST /api/beacon-attachment-ticket` (anonymous, honeypot- and rate-limited via
      `beacon-ratelimit.ts`) with the declared `contentType` and `bytes` for each intended file.
      The server validates against the caps and returns a short-lived write-only SAS URL per file,
      plus a server-generated `attachmentId`, targeting a **quarantine** prefix.
   2. Client PUTs each file directly to blob via its SAS.
   3. Client submits the normal JSON envelope with a small reference array:
      `attachments?: [{ id, contentType, bytes, sha256 }]`.
   4. Ingest validates each referenced blob exists, matches the declared content-type and size
      (re-checked from the actual blob, not trusted from the body), sniffs the real content-type,
      records a `bp_intakeattachment` child row per file, and hands the blob to the scan/promote
      pipeline.

   This keeps the envelope small and contract-clean (the only added field is a short reference
   array), offloads the heavy transfer from the Function to blob, and gives us a quarantine stage
   for scanning before anything is visible in triage.

### 2.3 Storage and data model (R4)

- **Blob:** a dedicated private container (for example `beacon-attachments`) with a `quarantine/`
  prefix for pre-scan copies and a promoted location for scanned-clean files. Reuse `blob.ts` SAS
  minting (`'cw'` for the upload ticket, `'r'` only ever for staff/triage reads).
- **Isolation key:** anonymous rows have no account anchor, so the deliverable pattern's
  account-prefix isolation does not apply directly. Beacon attachments are prefixed by
  server-controlled ids (`clientReportId` at ticket time, reconciled to the intake item id on
  ingest), and the isolation guarantee is that they are **internal-only**, mirroring the parent
  row's internal anchor. There is no account scope that can read them; only staff/triage can, via a
  server-mediated short-lived read SAS. This is the inverted check the isolation review asserts.
- **Dataverse:** a **child table** `bp_intakeattachment` with a lookup to `bp_intakeitem` and
  columns for blob ref, content-type, bytes, sha256, and scan status. Binaries live in blob;
  Dataverse holds references only. This matches the schema-as-code approach and avoids Dataverse
  file columns (expensive, awkward for video).

### 2.4 Caps and validation (R2)

- **Images (v1):** allow `image/png`, `image/jpeg`, `image/webp`. Cap per image (proposed 10 MB).
- **Video (fast follow, gated on R2):** allow `video/mp4` (H.264/AAC), optionally `video/webm`.
  Hard byte cap (proposed 25 MB) and a client-side duration guard (proposed 30 s). Duration is hard
  to verify server-side without decoding, so enforce bytes and content-type server-side and treat
  the duration cap as a client-side courtesy.
- **Count:** cap the number of attachments per report (proposed 3).
- **Server-side content-type sniff** on the actual bytes; reject when the sniffed type does not
  match the declared type or is not in the allow-list. Never trust the client-declared type alone.

### 2.5 Abuse, malware, and anonymous-endpoint hardening (R5)

An anonymous endpoint that accepts binaries is a malware-distribution and storage-abuse target.
Mitigations, mostly reusing what exists:

- **Quarantine + scan before visibility.** Uploads land in the quarantine prefix and are scanned
  (Defender for Storage malware scanning, or a scan function) before promotion. Triage only ever
  sees scanned-clean blobs.
- **Rate-limit the ticket endpoint** with `beacon-ratelimit.ts`, and keep the honeypot. Because
  binary upload raises the stakes, this is where the already-tracked `cp-beacon-anon-ratelimit`
  residual becomes a hard predecessor: no public/GA exposure of attachments until the ticket
  endpoint is covered (R5).
- **Write-only, short-TTL, single-blob SAS.** The upload SAS is `'cw'` only, scoped to one blob,
  minutes-long TTL, content-type pinned. SAS cannot enforce size directly, so ingest re-checks the
  actual blob size against the cap on promote.
- **No public read.** Triage reads via a server-mediated short-lived read SAS scoped to staff only.
- **Orphan cleanup.** Tickets minted but never submitted leave quarantine blobs; a lifecycle rule
  purges quarantine older than a short window.

### 2.6 Pane UI (bp-beacon, after the contract lands)

- A file picker accepting the allowed image (and later video) types, with `capture` supported on
  mobile so a reporter can grab a screenshot or record a short clip directly.
- Thumbnail/preview per attachment, a remove control, and inline, friendly enforcement of the caps
  (type, per-file size, count) before any upload starts.
- The disclosure copy from Part 2.1 sits next to the picker.
- The "What's included?" preview summarizes attachments (count, types, sizes), so the inspect view
  never drifts from what is actually sent.
- On submit the pane runs the two-phase flow (ticket, PUT, envelope) and surfaces upload progress
  and per-file failures without losing the typed report.

---

## Cross-repo contract and sequencing

Order matters because the SDK cannot merge an envelope the server rejects.

- **Phase 1 (bp-beacon, now, independent): reporter identity.** Envelope `contact?`, adapter
  `resolveIdentity` + submit `contact`, the merge rule, the pane field, disclosure in the inspect
  view. No server change. Ship it.
- **Phase 2 (client-portal, governing): attachments contract.** New spec, `bp_intakeattachment`
  schema-as-code, the private container + Bicep + a scoped Storage Blob Data Contributor grant on
  the Function MI, the ticket endpoint + SAS minting, ingest validation + promote, the scan
  pipeline, EXIF strip, retention, the isolation review, and the contract-test update. Gated on the
  rate-limit predecessor for any public exposure (R5).
- **Phase 3 (bp-beacon): attachments SDK + pane**, in lockstep with the contract test. Envelope
  reference array, the two-phase upload in the adapter, the pane picker/preview/caps.
- **Phase 4: KMP parity** for both `contact` and attachments, so web and native do not diverge.

## Landing homes on ratification

Single source of record: this proposal is staged in bp-beacon (the active worktree and a primary
consumer). On ratification it splits to its canonical homes.

- **Contract and server design** to client-portal: amend `docs/beacon-anon-ingest-spec.md` for
  `contact` surfacing and add a `docs/beacon-attachments-spec.md` for Part 2. The schema, endpoint,
  storage, and isolation review are client-portal's to own.
- **SDK and pane design** stays with bp-beacon.
- Each phase becomes a queued item in its repo's cadence (`next.yml` for bp-beacon slices, the
  client-portal intake/roadmap for the contract work).

## Open questions (owner rulings beyond the decisions block)

- **Retention specifics:** the TTL on quarantine copies, and whether promoted attachments purge on
  decline/close or on a fixed clock. Proposed default: purge on row deletion/decline, plus a
  quarantine TTL of 24 h for un-submitted uploads.
- **Video, if approved (R2):** confirm the 25 MB / 30 s caps, or set your own.
- **Attachment count:** confirm 3, or set your own.
- **EXIF strip scope:** images only, or also strip container-level metadata from video.

## Non-goals / out of scope

- No automatic screenshots or screen capture. Attachments are always reporter-initiated.
- No change to the anonymous/internal-anchor model for the row itself. Identity rides as the
  existing explicit `contact`, not as a new authenticated anchor (the D2 ratification stands).
- No client-readable attachments. Attachments inherit the parent row's internal-only visibility.
- No new design-system dependency in the pane. It stays themed by `--beacon-*` variables.

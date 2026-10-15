// The shared, design-system-agnostic Beacon feedback form. Self-contained (no design-system dependency):
// every colour/spacing token is a CSS variable the host sets (with a neutral fallback), so a product themes
// it in its own palette without forking the component. Renders the kind toggle (Issue/Idea), title,
// details, the consent gate + an inspect of exactly what auto-context would ride, and submits through the
// injected FeedbackAdapter. Submit-only + anonymous: no reports list.
//
// "Issue" is the reporter-facing label for a bug (owner rename); the wire kind stays 'bug'.

import { useEffect, useRef, useState } from 'react'
import type { FeedbackAdapter, FeedbackKind, BeaconContext } from './types.js'
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, validateAttachmentFile } from './attachments.js'

export interface FeedbackPaneProps {
  adapter: FeedbackAdapter
  // Gather the allow-list context to preview under "what's included" (same object the adapter sends).
  // Usually `() => gatherWebContext(cfg)`.
  gatherContext?: () => BeaconContext
  // Host-known reporter identity for PREFILL (owner ruling R6, "both"): when the host knows who the user
  // is, wire this and the contact field is prefilled, still editable and clearable. Resolved once on mount.
  // The pane always sends the field's value, so wire this ON THE PANE when using it (the adapter-config
  // resolveIdentity is only the fallback for direct submit callers).
  resolveIdentity?: () => string | undefined
  onDone?: (result: { id: string; reference?: string }) => void
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Issue' },
  { value: 'idea', label: 'Idea' },
]

// Pull image files from a paste (or drop). Covers BOTH clipboardData.files (Chromium) and
// clipboardData.items -> getAsFile() (Firefox/Safari, and "copy image" from a web page, which populate
// items but not files). Dedupes by name/size/type, since Chromium reports the same pasted image in both.
function imagesFromClipboard(cd: DataTransfer | null): File[] {
  if (!cd) return []
  const out: File[] = []
  const seen = new Set<string>()
  const add = (f: File | null) => {
    if (!f || !f.type.startsWith('image/')) return
    const key = `${f.name}|${f.size}|${f.type}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(f)
  }
  for (const f of Array.from(cd.files ?? [])) add(f)
  const items = cd.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it && it.kind === 'file') add(it.getAsFile())
    }
  }
  return out
}

export function FeedbackPane({ adapter, gatherContext, resolveIdentity, onDone }: FeedbackPaneProps) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  // Reporter contact (R6). Prefilled once from the host-known identity when available; the reporter can
  // edit or clear it. `prefill` is captured on mount so the "from your account" hint shows only while the
  // field still holds the untouched prefill.
  const [prefill] = useState(() => resolveIdentity?.() ?? '')
  const [contact, setContact] = useState(prefill)
  // Default ON, still declinable (owner ruling 2026-08-29): diagnostics are pre-attached so a triager can
  // reproduce a report, and the reporter can untick to file a content-only report. Disclosed +
  // inspectable ("What's included?"); the D3 allow-list is unchanged (no id, no study data, ever).
  const [consent, setConsent] = useState(true)
  const [showIncluded, setShowIncluded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ reference?: string } | null>(null)
  // Reporter-attached images (cp-beacon-attachments). Only offered when the adapter can upload (a
  // ticketEndpoint was configured). Each holds a stable object-URL for the preview, revoked on remove.
  const [attachments, setAttachments] = useState<{ file: File; url: string }[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const canAttach = typeof adapter.uploadAttachments === 'function'
  // A ref mirror of `attachments`, so the document-level paste listener (bound once) always caps against
  // the current count without a stale closure.
  const attachmentsRef = useRef<{ file: File; url: string }[]>([])
  attachmentsRef.current = attachments

  const canSend = title.trim().length >= 3 && !busy

  // Add images from any source (file input, drag-drop, or clipboard paste). Validates each against the
  // image allow-list + size cap and stops at MAX_ATTACHMENTS; the first rejection is surfaced.
  function addFiles(picked: File[]) {
    let err: string | null = null
    const additions: { file: File; url: string }[] = []
    for (const f of picked) {
      if (attachmentsRef.current.length + additions.length >= MAX_ATTACHMENTS) {
        err = `You can attach up to ${MAX_ATTACHMENTS} images.`
        break
      }
      const verr = validateAttachmentFile(f)
      if (verr) {
        err = verr
        continue
      }
      additions.push({ file: f, url: URL.createObjectURL(f) })
    }
    if (additions.length) setAttachments((cur) => [...cur, ...additions])
    setAttachError(err)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // let the reporter re-pick the same file after a remove
    addFiles(picked)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const imgs = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (imgs.length) addFiles(imgs)
  }

  // Clipboard paste (Ctrl/Cmd+V): a screenshot lives on the clipboard (Win+Shift+S, Cmd+Ctrl+Shift+4),
  // so pasting attaches it directly - the single biggest convenience for a screenshot feature. Bound at the
  // document while the picker is available; only IMAGE items are consumed, so pasting text into a field is
  // untouched. addFiles reads attachmentsRef, so binding once is safe.
  useEffect(() => {
    if (!canAttach) return
    function onPaste(e: ClipboardEvent) {
      const imgs = imagesFromClipboard(e.clipboardData)
      if (imgs.length) {
        e.preventDefault()
        addFiles(imgs)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAttach])

  function removeAttachment(i: number) {
    setAttachments((cur) => {
      const a = cur[i]
      if (a) URL.revokeObjectURL(a.url)
      return cur.filter((_, j) => j !== i)
    })
    setAttachError(null)
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      // Two-phase attachments: upload first (best-effort), then submit with the refs + the shared id so the
      // envelope and the uploaded blobs match. A failed upload is skipped by the adapter; the report still files.
      let attachmentRefs: { id: string; contentType: string; bytes: number }[] | undefined
      let clientReportId: string | undefined
      if (attachments.length && adapter.uploadAttachments) {
        setUploading(true)
        try {
          const up = await adapter.uploadAttachments(attachments.map((a) => a.file))
          attachmentRefs = up.attachments
          clientReportId = up.clientReportId
        } finally {
          setUploading(false)
        }
      }
      const result = await adapter.submit({
        kind,
        title: title.trim(),
        details: details.trim(),
        consent,
        contact: contact.trim(),
        attachments: attachmentRefs,
        clientReportId,
      })
      setDone({ reference: result.reference })
      onDone?.(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div style={{ color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit') }}>
        <p style={{ margin: 0 }}>Thanks - your {kind === 'bug' ? 'issue' : 'idea'} was sent.</p>
        {done.reference ? <p style={{ margin: '8px 0 0', opacity: 0.7 }}>Reference: {done.reference}</p> : null}
      </div>
    )
  }

  const included = showIncluded && gatherContext ? gatherContext() : null

  return (
    <div style={{ color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit'), display: 'grid', gap: 12 }}>
      <div role="tablist" aria-label="Feedback kind" style={{ display: 'flex', gap: 8 }}>
        {KINDS.map((k) => (
          <button
            key={k.value}
            role="tab"
            aria-selected={kind === k.value}
            onClick={() => setKind(k.value)}
            style={{
              padding: '6px 12px',
              borderRadius: v('radius', '8px'),
              border: `1px solid ${v('border', '#d0d0d0')}`,
              background: kind === k.value ? v('accent', '#9B251B') : 'transparent',
              color: kind === k.value ? v('accent-fg', '#fff') : v('fg', '#1a1a1a'),
              cursor: 'pointer',
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'bug' ? 'What went wrong?' : "What's your idea?"}
          maxLength={200}
          style={{ padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Details</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={5000}
          style={{ padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a'), resize: 'vertical' }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>How can we reach you? (optional)</span>
        <input
          type="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
          autoComplete="email"
          style={{ padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') }}
        />
        {prefill.length > 0 && contact === prefill ? (
          <span style={{ fontSize: 11, opacity: 0.6 }}>Filled from your account. Edit or clear it if you like.</span>
        ) : null}
      </label>

      {canAttach ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragging) setDragging(true)
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={onDrop}
          style={{
            display: 'grid',
            gap: 6,
            padding: 10,
            borderRadius: v('radius', '8px'),
            border: `1px dashed ${dragging ? v('accent', '#9B251B') : v('border', '#d0d0d0')}`,
            background: dragging ? v('field-bg', 'rgba(0,0,0,0.03)') : 'transparent',
            transition: 'border-color .12s, background-color .12s',
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            {dragging ? 'Drop the image here' : 'Add a screenshot (optional)'}
          </span>
          {attachments.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map((a, i) => (
                <div key={a.url} style={{ position: 'relative', width: 64, height: 64 }}>
                  <img
                    src={a.url}
                    alt={a.file.name}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}` }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${a.file.name}`}
                    onClick={() => removeAttachment(i)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, lineHeight: '16px', textAlign: 'center', padding: 0, borderRadius: '50%', border: 'none', background: v('accent', '#9B251B'), color: v('accent-fg', '#fff'), cursor: 'pointer', fontSize: 12 }}
                  >
                    &#215;
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {attachments.length < MAX_ATTACHMENTS ? (
            <label style={{ justifySelf: 'start', fontSize: 13, color: v('accent', '#9B251B'), cursor: 'pointer' }}>
              + Add image
              <input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={onPick} style={{ display: 'none' }} />
            </label>
          ) : null}
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            Drag an image in, or paste a screenshot (Ctrl+V). PNG, JPEG, or WebP, up to 10 MB each.
            Attachments can contain personal information, so only include what you are comfortable sharing.
          </span>
          {attachError ? <span style={{ fontSize: 12, color: v('error', '#9B251B') }}>{attachError}</span> : null}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 4 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Include basic diagnostics (app version, screen, device type, OS, language) to help us investigate.</span>
        </label>
        {gatherContext ? (
          <button
            type="button"
            onClick={() => setShowIncluded((s) => !s)}
            style={{ justifySelf: 'start', background: 'none', border: 'none', color: v('accent', '#9B251B'), cursor: 'pointer', padding: 0, fontSize: 12 }}
          >
            {showIncluded ? 'Hide' : "What's included?"}
          </button>
        ) : null}
        {included ? (
          <pre style={{ margin: 0, fontSize: 11, opacity: 0.75, whiteSpace: 'pre-wrap', background: v('inspect-bg', '#f4f4f4'), padding: 8, borderRadius: v('radius', '8px') }}>
            {JSON.stringify(included, null, 2)}
          </pre>
        ) : null}
      </div>

      {error ? <p style={{ margin: 0, color: v('error', '#9B251B'), fontSize: 13 }}>{error}</p> : null}

      <button
        onClick={send}
        disabled={!canSend}
        style={{
          padding: '8px 16px',
          borderRadius: v('radius', '8px'),
          border: 'none',
          background: canSend ? v('accent', '#9B251B') : v('border', '#d0d0d0'),
          color: v('accent-fg', '#fff'),
          cursor: canSend ? 'pointer' : 'not-allowed',
          justifySelf: 'start',
        }}
      >
        {uploading ? 'Uploading...' : busy ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

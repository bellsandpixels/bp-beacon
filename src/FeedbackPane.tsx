// The shared, design-system-agnostic Beacon feedback form. Self-contained (no design-system dependency):
// every colour/spacing token is a CSS variable the host sets (with a neutral fallback), so a product themes
// it in its own palette without forking the component. Renders the kind toggle (Issue/Idea), title,
// details, the consent gate + an inspect of exactly what auto-context would ride, and submits through the
// injected FeedbackAdapter. Submit-only + anonymous: no reports list.
//
// "Issue" is the reporter-facing label for a bug (owner rename); the wire kind stays 'bug'.

import { useState } from 'react'
import type { FeedbackAdapter, FeedbackKind, BeaconContext } from './types.js'

export interface FeedbackPaneProps {
  adapter: FeedbackAdapter
  // Gather the allow-list context to preview under "what's included" (same object the adapter sends).
  // Usually `() => gatherWebContext(cfg)`.
  gatherContext?: () => BeaconContext
  onDone?: (result: { id: string; reference?: string }) => void
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Issue' },
  { value: 'idea', label: 'Idea' },
]

export function FeedbackPane({ adapter, gatherContext, onDone }: FeedbackPaneProps) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [consent, setConsent] = useState(false)
  const [showIncluded, setShowIncluded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ reference?: string } | null>(null)

  const canSend = title.trim().length >= 3 && !busy

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const result = await adapter.submit({ kind, title: title.trim(), details: details.trim(), consent })
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

      <div style={{ display: 'grid', gap: 4 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Include basic diagnostics (app version, screen, platform, language) to help us investigate.</span>
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
        {busy ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

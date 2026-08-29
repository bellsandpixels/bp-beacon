// The shared, design-system-agnostic Beacon VALIDATION-HUB pane, the walk analog of FeedbackPane. Themed
// entirely by --beacon-* CSS variables the host sets (neutral fallbacks), so a product themes it in its
// own palette without forking. This is the hub the tester reaches in one gesture: click Beacon, click
// Validation, authenticate once (adapter-owned), and the three zones are here: To do (walk this build),
// Completed (past walks + coverage), and My issues (raised issues + their disposition, incl. "Fixed in
// build X"). The assume-pass tap-to-tick walk SURFACE is a separate component (Phase B); starting a walk
// is delegated to onStartWalk so the host renders the surface. Scaffold: the hub + auth gate; the surface
// and live wiring land in Phase B. See the approved Beacon walk mocks.

import { useCallback, useEffect, useState } from 'react'
import type { WalkAdapter, WalkAvailability, WalkSummary, WalkIssue, WalkIdentity } from './walkTypes.js'

export interface WalkPaneProps {
  adapter: WalkAdapter
  // Open the assume-pass walk surface for the offered build (the host renders it; the surface calls the
  // adapter's markWalked/flag/submit). Omitted in the scaffold renders a disabled Start.
  onStartWalk?: (availability: WalkAvailability) => void
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

// Reporter-facing disposition labels. A resolved issue is a DISTINCT "Fixed in build X" state (never a
// bare Closed): that is rendered from WalkIssue.resolvedBuild, ahead of this map.
const STATUS_LABEL: Record<WalkIssue['status'], string> = {
  submitted: 'Submitted',
  triaging: 'Triaging',
  accepted: 'Accepted',
  routed: 'Routed',
  declined: 'Declined',
  duplicate: 'Duplicate',
  parked: 'Parked',
  closed: 'Closed',
}

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          fontFamily: v('mono', 'ui-monospace, monospace'),
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: 0.65,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  )
}

export function WalkPane({ adapter, onStartWalk }: WalkPaneProps) {
  const [identity, setIdentity] = useState<WalkIdentity | null>(null)
  const [availability, setAvailability] = useState<WalkAvailability | null>(null)
  const [completed, setCompleted] = useState<WalkSummary[]>([])
  const [issues, setIssues] = useState<WalkIssue[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHub = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [avail, mine, myIssues] = await Promise.all([
        adapter.available(),
        adapter.listMine(),
        adapter.listMyIssues(),
      ])
      setAvailability(avail)
      setCompleted(mine)
      setIssues(myIssues)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your walks.')
    } finally {
      setBusy(false)
    }
  }, [adapter])

  useEffect(() => {
    let live = true
    adapter
      .identity()
      .then((id) => {
        if (!live) return
        setIdentity(id)
        if (id.authenticated) void loadHub()
      })
      .catch(() => live && setIdentity({ authenticated: false }))
    return () => {
      live = false
    }
  }, [adapter, loadHub])

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      const id = await adapter.authenticate()
      setIdentity(id)
      if (id.authenticated) await loadHub()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  const base: React.CSSProperties = {
    color: v('fg', '#1a1a1a'),
    padding: v('pad', '16px'),
    fontFamily: v('font', 'inherit'),
    display: 'grid',
    gap: 16,
  }

  // Unauthenticated: the sign-in gate (one click, adapter-owned).
  if (identity && !identity.authenticated) {
    return (
      <div style={base}>
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontFamily: v('serif', 'inherit') }}>Sign in to your tester walk</strong>
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            One click and your walks, coverage, and issue status are here.
          </span>
        </div>
        {error ? <p style={{ margin: 0, color: v('error', '#9B251B'), fontSize: 13 }}>{error}</p> : null}
        <button
          onClick={signIn}
          disabled={busy}
          style={{
            padding: '8px 16px',
            borderRadius: v('radius', '8px'),
            border: 'none',
            background: v('accent', '#9B251B'),
            color: v('accent-fg', '#fff'),
            cursor: busy ? 'default' : 'pointer',
            justifySelf: 'start',
          }}
        >
          {busy ? 'Signing in...' : 'Send magic link'}
        </button>
      </div>
    )
  }

  // Loading identity or hub.
  if (!identity || (busy && !completed.length && !issues.length && !availability)) {
    return <div style={base}><span style={{ opacity: 0.6, fontSize: 13 }}>Loading your walk...</span></div>
  }

  return (
    <div style={base}>
      {error ? <p style={{ margin: 0, color: v('error', '#9B251B'), fontSize: 13 }}>{error}</p> : null}

      <Zone label="To do">
        {availability?.offered ? (
          <div
            style={{
              border: `1px solid ${v('border', '#d0d0d0')}`,
              borderLeft: `3px solid ${v('accent', '#9B251B')}`,
              borderRadius: v('radius', '10px'),
              padding: 12,
              display: 'grid',
              gap: 8,
            }}
          >
            <strong style={{ fontFamily: v('serif', 'inherit') }}>Walk this build</strong>
            <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.8 }}>
              {availability.build} ({availability.env})
            </span>
            <button
              onClick={() => (onStartWalk && availability ? onStartWalk(availability) : undefined)}
              disabled={!onStartWalk}
              style={{
                padding: '6px 12px',
                borderRadius: v('radius', '8px'),
                border: 'none',
                background: onStartWalk ? v('accent', '#9B251B') : v('border', '#d0d0d0'),
                color: v('accent-fg', '#fff'),
                cursor: onStartWalk ? 'pointer' : 'not-allowed',
                justifySelf: 'start',
              }}
            >
              Start walk
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 13, opacity: 0.6 }}>No walk is offered for this build.</span>
        )}
      </Zone>

      <Zone label="Completed">
        {completed.length ? (
          completed.map((w) => (
            <div key={w.walkId} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, paddingTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 13 }}>{w.build}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {w.coverage.walked} / {w.coverage.total} walked{w.flagged ? ` · ${w.flagged} flagged` : ''}
                </div>
              </div>
            </div>
          ))
        ) : (
          <span style={{ fontSize: 13, opacity: 0.6 }}>No completed walks yet.</span>
        )}
      </Zone>

      <Zone label="My issues">
        {issues.length ? (
          issues.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, paddingTop: 8 }}>
              <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }}>#{it.checkRef}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{it.title}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>raised on {it.build}</div>
              </div>
              <span
                style={{
                  fontFamily: v('mono', 'ui-monospace, monospace'),
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: it.resolvedBuild ? v('ok-bg', '#e7efe4') : v('chip-bg', '#f0f0f0'),
                  color: it.resolvedBuild ? v('ok', '#2f6d3a') : v('fg', '#1a1a1a'),
                  whiteSpace: 'nowrap',
                }}
              >
                {it.resolvedBuild ? `Fixed ${it.resolvedBuild}` : STATUS_LABEL[it.status]}
              </span>
            </div>
          ))
        ) : (
          <span style={{ fontSize: 13, opacity: 0.6 }}>Nothing raised yet.</span>
        )}
      </Zone>
    </div>
  )
}

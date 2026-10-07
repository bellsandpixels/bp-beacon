// The shared, design-system-agnostic assume-pass WALK SURFACE, ported from the approved Beacon walk mocks.
// Themed by --beacon-* CSS variables (neutral fallbacks) like FeedbackPane. Assume-pass: tasks are visible
// by default; a check passes unless flagged with a note; flagging a check auto-marks its surface walked
// (flagging is looking); the derived verdict updates live. Coverage + flags call the injected WalkAdapter;
// Submit writes the walk record. The host opens this from the hub's "Start walk". See walkVerdict.ts for
// the assume-pass rules (kept in step with the bp-qa record format).

import { useEffect, useMemo, useState } from 'react'
import type { ValidationCatalogue, WalkAdapter, WalkCheckHelp, WalkStartOptions, WalkState } from './walkTypes.js'
import { surfacesOf, deriveVerdict } from './walkVerdict.js'
import { qrMatrix } from './qr.js'

export interface WalkSurfacePaneProps {
  catalogue: ValidationCatalogue
  adapter: WalkAdapter
  build?: string // shown in the header; usually availability.build
  env?: string
  // B2: launch a SPECIFIC assigned walk. Passed straight to adapter.start(), so the walk is created linked to
  // its bp_walkassignment (assignmentId) against this catalogue. Omitted -> the adapter's default current-build
  // start. Included in the start effect's deps so re-launching against a new assignment restarts the walk.
  startOpts?: WalkStartOptions
  onDone?: (summary: { walkId: string }) => void
  // Leave the walk part-way and go back to the hub. Progress is server-side, so leaving loses nothing; the
  // hub's Resume picks it up. Omitted -> no "Walks" back control (the pre-2026-10-06 behavior).
  onExit?: () => void
  // The walk's name in the header; defaults to the catalogue id.
  title?: string
  // Ways out of the pane, each shown only when the host supplies it (owner asks, 2026-10-06).
  links?: WalkLinks
}

/** Host-supplied URLs for the walk toolbar. All point at the SAME walk, so progress carries over. */
export interface WalkLinks {
  // Opens this walk in its own browser window (the portal's walk page), so the pane can close while testing.
  popOut?: string
  // The walk's record for review (the portal's Testing tab).
  review?: string
  // The URL a second device (a tablet) opens to continue this walk; shown as a QR code and a copyable link.
  handoff?: string
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

/** A QR code for `text`, drawn as one SVG path. Encoded locally (qr.ts); the URL never goes to a QR service. */
function WalkQr({ text, size = 168 }: { text: string; size?: number }) {
  const path = useMemo(() => {
    const m = qrMatrix(text, { ecc: 'M' })
    let d = ''
    m.forEach((row, y) => row.forEach((on, x) => (on ? (d += `M${x},${y}h1v1h-1z`) : null)))
    return { d, n: m.length }
  }, [text])
  return (
    // A fixed light background and dark modules in both themes: phone cameras read dark-on-light reliably.
    <svg
      role="img"
      aria-label="QR code for this walk"
      viewBox={`-4 -4 ${path.n + 8} ${path.n + 8}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ background: '#fff', borderRadius: 8, display: 'block' }}
    >
      <path d={path.d} fill="#111" />
    </svg>
  )
}

function hasHelp(h?: WalkCheckHelp): h is WalkCheckHelp {
  return !!h && (!!(h.how && h.how.length) || !!h.why || !!h.success || !!h.failure)
}

/**
 * A check's authored guidance for a mixed-skill tester, ported from Toudai's retired TesterWalk (the layout
 * testers walked in before walks moved to the portal, toudai ffaf6bd8): a "Not sure? Show me how" toggle
 * opens How to do this (the steps) and Why this matters, then two columns, "Looks right when" and "Flag it
 * when". The columns stack on a narrow (phone) screen. Only the parts the catalogue authored are shown.
 */
function CheckHelp({ n, help }: { n: number; help: WalkCheckHelp }) {
  const [open, setOpen] = useState(false)
  const k = { margin: '0 0 4px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', opacity: 0.8 }
  const t = { margin: 0, fontSize: 13, lineHeight: 1.45 }
  const box = (color: string) => ({ border: `1px solid ${color}`, borderRadius: v('radius', '8px'), padding: 8 })
  const good = v('ok', '#2f6d3a')
  const bad = v('error', '#a8322b')
  return (
    <div data-testid={`walk-check-help-${n}`} style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: v('accent', '#9B251B') }}
      >
        <span aria-hidden>{open ? '−' : '+'}</span>
        {open ? 'Hide guidance' : 'Not sure? Show me how'}
      </button>
      {open ? (
        <div style={{ marginTop: 6, padding: 12, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#e4ddcd')}`, background: v('sunk', '#f0ebe0') }}>
          {help.how && help.how.length ? (
            <div style={{ marginBottom: 12 }}>
              <p style={k}>How to do this</p>
              <ol style={{ ...t, paddingLeft: 18 }}>
                {help.how.map((step, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {help.why ? (
            <div style={{ marginBottom: 12 }}>
              <p style={k}>Why this matters</p>
              <p style={t}>{help.why}</p>
            </div>
          ) : null}
          {help.success || help.failure ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {help.success ? (
                <div style={box(good)}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: good }}>Looks right when</p>
                  <p style={t}>{help.success}</p>
                </div>
              ) : null}
              {help.failure ? (
                <div style={box(bad)}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: bad }}>Flag it when</p>
                  <p style={t}>{help.failure}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function WalkSurfacePane({ catalogue, adapter, build, env, startOpts, onDone, onExit, title, links }: WalkSurfacePaneProps) {
  const [device, setDevice] = useState(false)
  const [copied, setCopied] = useState(false)
  const [state, setState] = useState<WalkState>({ walked: {}, defects: {} })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const surfaces = useMemo(() => surfacesOf(catalogue), [catalogue])
  const verdict = useMemo(() => deriveVerdict(catalogue, state), [catalogue, state])

  useEffect(() => {
    let live = true
    setBusy(true)
    adapter
      .start(startOpts)
      .then((s) => live && setState({ walked: s.walked || {}, defects: s.defects || {} }))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not start the walk.'))
      .finally(() => live && setBusy(false))
    return () => {
      live = false
    }
  }, [adapter, startOpts])

  async function toggleWalked(surfaceKey: string) {
    const next = !state.walked[surfaceKey]
    // Unwalking a surface also clears its flags, so a counted defect can never survive on a NOT-WALKED
    // surface (which would make the verdict read "must-fix ... across 0 walked surfaces").
    const surface = surfaces.find((s) => s.key === surfaceKey)
    const clearing =
      !next && surface
        ? surface.checks.map((c) => c.n).filter((n) => Object.prototype.hasOwnProperty.call(state.defects, n))
        : []
    setState((s) => {
      const walked = { ...s.walked }
      if (next) walked[surfaceKey] = true
      else delete walked[surfaceKey]
      const defects = { ...s.defects }
      for (const n of clearing) delete defects[n]
      return { ...s, walked, defects }
    })
    try {
      await adapter.markWalked(surfaceKey, next)
      for (const n of clearing) await adapter.clearFlag(n)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    }
  }

  async function toggleFlag(surfaceKey: string, n: number) {
    const has = Object.prototype.hasOwnProperty.call(state.defects, n)
    if (has) {
      setState((s) => {
        const defects = { ...s.defects }
        delete defects[n]
        return { ...s, defects }
      })
      try {
        await adapter.clearFlag(n)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not clear that.')
      }
    } else {
      // Flagging a check means you looked at the surface: auto-walk it.
      setState((s) => ({ walked: { ...s.walked, [surfaceKey]: true }, defects: { ...s.defects, [n]: '' } }))
      try {
        await adapter.markWalked(surfaceKey, true)
        await adapter.flag({ checkRef: n, note: '' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not flag that.')
      }
    }
  }

  // Typing only updates local state; the note is synced to the adapter once, on blur (below). flag()
  // upserts by checkRef, so one intake item is updated, not one created per keystroke.
  function setNote(n: number, note: string) {
    setState((s) => ({ ...s, defects: { ...s.defects, [n]: note } }))
  }

  // The note is the defect. Sync it when the field loses focus, and surface a failure like every other
  // write, so a lost note can never pass unnoticed into a submit (empty note = in-progress flag, still
  // tracked). Awaited and single, so writes stay ordered and last-typed wins.
  async function syncNote(n: number, note: string) {
    try {
      await adapter.flag({ checkRef: n, note })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that note.')
    }
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const summary = await adapter.submit()
      onDone?.({ walkId: summary.walkId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the walk.')
    } finally {
      setSubmitting(false)
    }
  }

  const verdictColor =
    verdict.label === 'PASS' ? v('ok', '#2f6d3a') : verdict.label === 'BLOCKED' || verdict.label === 'FAIL' ? v('error', '#a8322b') : v('muted', '#8a836f')

  const mono = { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.75 }
  const linkBtn = { border: 'none', background: 'transparent', padding: '4px 0', color: v('accent', '#9B251B'), cursor: 'pointer', fontSize: 13, fontWeight: 600 }
  const toolBtn = (hi = false) => ({
    fontSize: 12,
    padding: '5px 10px',
    borderRadius: v('radius', '8px'),
    border: `1px solid ${hi ? v('accent', '#9B251B') : v('border', '#d0d0d0')}`,
    background: 'transparent',
    color: v('fg', '#1a1a1a'),
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })
  const wrap = { color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit'), display: 'grid', gap: 14 }

  async function copyHandoff() {
    if (!links?.handoff) return
    try {
      await navigator.clipboard.writeText(links.handoff)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the link. Select it and copy it by hand.')
    }
  }

  const header = (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {onExit ? (
          <button onClick={onExit} style={linkBtn} data-testid="walk-exit">
            &larr; Walks
          </button>
        ) : null}
        <div style={{ marginLeft: onExit ? 'auto' : 0, textAlign: onExit ? 'right' : 'left', display: 'grid' }}>
          <strong style={{ fontFamily: v('serif', 'inherit') }}>{title || catalogue.catalogueId}</strong>
          <span style={mono}>
            {build ? `${build}${env ? ` (${env})` : ''} · ` : ''}
            {verdict.walked} / {verdict.total} walked{verdict.defects ? ` · ${verdict.defects} flagged` : ''}
          </span>
        </div>
      </div>
      {links && (links.popOut || links.review || links.handoff) ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${v('border', '#e4ddcd')}`, paddingTop: 8 }}>
          {links.popOut ? (
            <button
              style={toolBtn()}
              title="Open this walk in its own window"
              onClick={() => window.open(links.popOut, 'bp-validation-walk', 'popup=yes,width=820,height=960')}
            >
              ⧉ Pop out
            </button>
          ) : null}
          {links.review ? (
            <button style={toolBtn()} title="Open the walk record in the portal" onClick={() => window.open(links.review, '_blank', 'noopener')}>
              ↗ Review in portal
            </button>
          ) : null}
          {links.handoff ? (
            <button style={toolBtn(true)} title="Continue this walk on a tablet or phone" onClick={() => setDevice(true)}>
              ▣ Another device
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  // Continue on another device: the same walk's URL as a QR code and a copyable link. The walk itself stays
  // mounted underneath (this is a view swap, not a navigation), so Back returns with nothing lost.
  if (device && links?.handoff) {
    return (
      <div style={wrap}>
        <button onClick={() => setDevice(false)} style={{ ...linkBtn, justifySelf: 'start' }}>
          &larr; Back to the walk
        </button>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, textAlign: 'center' }}>
          <span style={{ ...mono, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Continue on another device</span>
          <strong style={{ fontFamily: v('serif', 'inherit'), fontSize: 18 }}>Scan to walk on your tablet</strong>
          <WalkQr text={links.handoff} />
          <p style={{ margin: 0, fontSize: 13, maxWidth: 340 }}>
            Sign in on the tablet with your B&amp;P email. Your walked checks and flags carry over, because they are saved
            on the server.
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', maxWidth: '100%', border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '8px'), padding: '6px 8px' }}>
            <span style={{ ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{links.handoff}</span>
            <button style={toolBtn()} onClick={copyHandoff}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {error ? <p style={{ margin: 0, color: v('error', '#a8322b'), fontSize: 13 }}>{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      {header}

      {busy ? <span style={{ opacity: 0.6, fontSize: 13 }}>Loading the walk...</span> : null}
      {error ? <p style={{ margin: 0, color: v('error', '#a8322b'), fontSize: 13 }}>{error}</p> : null}

      {surfaces.map((s) => {
        const on = !!state.walked[s.key]
        return (
          <div key={s.key} style={{ border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '10px'), overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: v('sunk', '#f0ebe0') }}>
              <strong style={{ flex: 1, fontFamily: v('serif', 'inherit'), fontSize: 14 }}>
                {s.title}
                {s.route ? <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6, marginLeft: 6 }}>{s.route}</span> : null}
              </strong>
              <button
                onClick={() => toggleWalked(s.key)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: v('radius', '7px'),
                  border: `1px solid ${on ? v('ok', '#2f6d3a') : v('border', '#d0d0d0')}`,
                  background: on ? v('ok-bg', '#e7efe4') : 'transparent',
                  color: on ? v('ok', '#2f6d3a') : v('fg', '#1a1a1a'),
                  cursor: 'pointer',
                }}
              >
                {on ? 'Walked' : 'Mark walked'}
              </button>
            </div>
            {!on ? (
              <div style={{ padding: '6px 10px', fontSize: 12, fontStyle: 'italic', opacity: 0.6, borderBottom: `1px solid ${v('border', '#eee')}` }}>
                Not walked yet. Read the {s.checks.length} checks and flag anything wrong.
              </div>
            ) : null}
            {s.checks.map((c) => {
              const has = Object.prototype.hasOwnProperty.call(state.defects, c.n)
              const note = state.defects[c.n] ?? ''
              const noted = has && note.trim().length > 0
              return (
                <div key={c.n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderTop: `1px solid ${v('border', '#eee')}`, background: has ? (noted ? v('bad-bg', '#f6e5e1') : 'transparent') : 'transparent' }}>
                  <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }}>{c.n}.</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: noted ? v('error', '#a8322b') : v('fg', '#1a1a1a') }}>
                      {c.text}
                      {c.severity === 'blocker' ? (
                        <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: v('error', '#a8322b'), border: `1px solid ${v('error', '#a8322b')}`, borderRadius: 4, padding: '0 4px', marginLeft: 6 }}>
                          must-fix
                        </span>
                      ) : null}
                    </span>
                    {hasHelp(c.help) ? <CheckHelp n={c.n} help={c.help} /> : null}
                    {has ? (
                      <>
                        <input
                          value={note}
                          onChange={(e) => setNote(c.n, e.target.value)}
                          onBlur={(e) => syncNote(c.n, e.target.value)}
                          placeholder="What is wrong? This becomes the defect record."
                          aria-label={`Defect note for check ${c.n}`}
                          style={{ display: 'block', width: '100%', marginTop: 6, padding: 6, fontSize: 13, borderRadius: v('radius', '7px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') }}
                        />
                        {!noted ? (
                          <p style={{ margin: '4px 0 0', fontSize: 11, fontStyle: 'italic', opacity: 0.6 }}>
                            Note required. Until you write what is wrong, this is not counted as a defect.
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <button
                    onClick={() => toggleFlag(s.key, c.n)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: v('radius', '6px'), border: `1px solid ${has ? v('error', '#a8322b') : v('border', '#d0d0d0')}`, background: 'transparent', color: has ? v('error', '#a8322b') : v('fg', '#1a1a1a'), cursor: 'pointer', flex: 'none' }}
                  >
                    {has ? 'Clear' : 'Flag'}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      <div style={{ borderTop: `1px solid ${v('border', '#e4ddcd')}`, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: verdictColor }}>{verdict.line}</span>
        <button
          onClick={submit}
          disabled={submitting}
          style={{ padding: '8px 16px', borderRadius: v('radius', '8px'), border: 'none', background: v('accent', '#9B251B'), color: v('accent-fg', '#fff'), cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Submitting...' : 'Submit walk'}
        </button>
      </div>
    </div>
  )
}

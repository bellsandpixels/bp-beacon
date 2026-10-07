// The shared, design-system-agnostic Beacon VALIDATION-HUB pane, the walk analog of FeedbackPane. Themed
// entirely by --beacon-* CSS variables the host sets (neutral fallbacks), so a product themes it in its
// own palette without forking. This is the hub the tester reaches in one gesture: click Beacon, click
// Validation, authenticate once (adapter-owned), and the three zones are here: To do (walk this build),
// Completed (past walks + coverage), and My issues (raised issues + their disposition, incl. "Fixed in
// build X"). The assume-pass tap-to-tick walk SURFACE is a separate component (Phase B); starting a walk
// is delegated to onStartWalk so the host renders the surface. Scaffold: the hub + auth gate; the surface
// and live wiring land in Phase B. See the approved Beacon walk mocks.

import { useCallback, useEffect, useState } from 'react'
import { groupAssignments } from './walkList.js'
import type { WalkAdapter, WalkAssignmentSummary, WalkAvailability, WalkInProgress, WalkSummary, WalkIssue, WalkIdentity } from './walkTypes.js'

export interface WalkPaneProps {
  adapter: WalkAdapter
  // Open the assume-pass walk surface for the offered build (the host renders it; the surface calls the
  // adapter's markWalked/flag/submit). Omitted in the scaffold renders a disabled Start.
  onStartWalk?: (availability: WalkAvailability) => void
  // B2: launch a SPECIFIC assigned walk from its To-do card (the host resolves the assignment's catalogue and
  // starts the walk with its assignmentId, so the completed walk clears the card and advances the stage).
  // Omitted -> the assigned cards render without a Start (display-only, the pre-B2 behavior).
  onStartAssignment?: (assignment: WalkAssignmentSummary) => void
  // A one-line confirmation the host shows above the list, e.g. "Walk saved" after the tester leaves a walk
  // part-way (progress is server-side, so leaving never loses it). onDismissNotice adds a close control.
  notice?: string | null
  onDismissNotice?: () => void
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

type HubTab = 'todo' | 'completed' | 'issues'

// How many walks a build group shows before "Show N more".
const GROUP_PAGE = 6

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

export function WalkPane({ adapter, onStartWalk, onStartAssignment, notice, onDismissNotice }: WalkPaneProps) {
  const [tab, setTab] = useState<HubTab>('todo')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})
  const [identity, setIdentity] = useState<WalkIdentity | null>(null)
  const [availability, setAvailability] = useState<WalkAvailability | null>(null)
  const [inProgress, setInProgress] = useState<WalkInProgress | null>(null)
  const [completed, setCompleted] = useState<WalkSummary[]>([])
  const [issues, setIssues] = useState<WalkIssue[]>([])
  const [assigned, setAssigned] = useState<WalkAssignmentSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHub = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [avail, current, mine, myIssues, assignedList] = await Promise.all([
        adapter.available(),
        // Additive-only: the in-progress read just decides Start vs Resume, so its failure must degrade to
        // "Start walk", never blank the hub. Isolate it (unlike the other three, which gate the hub) so a
        // 404 - e.g. the current-walk endpoint not yet deployed (the API deploys by hand) - yields null.
        adapter.current().catch(() => null),
        adapter.listMine(),
        adapter.listMyIssues(),
        // Slice 4c: the assigned-walks list is OPTIONAL + isolated (like current()), so an adapter without
        // listAssigned, or a 404 on /available, degrades to no assigned list rather than blanking the hub.
        adapter.listAssigned ? adapter.listAssigned().catch(() => []) : Promise.resolve([] as WalkAssignmentSummary[]),
      ])
      setAvailability(avail)
      setInProgress(current)
      setCompleted(mine)
      setIssues(myIssues)
      setAssigned(assignedList)
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

  const todo = groupAssignments(assigned)
  const offered = !!availability?.offered
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, padding: '8px 0' }
  const mono: React.CSSProperties = { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.65 }
  const startBtn = (primary: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: v('radius', '8px'),
    border: primary ? 'none' : `1px solid ${v('border', '#d0d0d0')}`,
    background: primary ? v('accent', '#9B251B') : 'transparent',
    color: primary ? v('accent-fg', '#fff') : v('fg', '#1a1a1a'),
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  })

  const tabs: { key: HubTab; label: string; count: number }[] = [
    { key: 'todo', label: 'To do', count: assigned.length },
    { key: 'completed', label: 'Completed', count: completed.length },
    { key: 'issues', label: 'My issues', count: issues.length },
  ]

  return (
    <div style={base}>
      {error ? <p style={{ margin: 0, color: v('error', '#9B251B'), fontSize: 13 }}>{error}</p> : null}

      {/* The build being walked comes first: it is the one walk every tester is asked for. */}
      {offered && availability ? (
        <div
          data-testid="walk-this-build"
          style={{
            border: `1px solid ${v('border', '#d0d0d0')}`,
            borderLeft: `3px solid ${v('accent', '#9B251B')}`,
            borderRadius: v('radius', '10px'),
            padding: 12,
            display: 'grid',
            gap: 6,
          }}
        >
          <span style={{ ...mono, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {inProgress ? 'Resume your walk' : 'Walk this build'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* When resuming, name the walk's OWN build/env (an older unsubmitted walk is resumed as-is; the
                  start/current queries carry no build filter), not the current offer's, so the card is honest. */}
              <strong style={{ fontFamily: v('serif', 'inherit') }}>{inProgress?.build || availability.build}</strong>
              <div style={mono}>
                {inProgress?.env || availability.env}
                {inProgress
                  ? ` · ${inProgress.coverage.total > 0 ? `${inProgress.coverage.walked} / ${inProgress.coverage.total}` : inProgress.coverage.walked} walked${inProgress.flagged ? ` · ${inProgress.flagged} flagged` : ''}`
                  : ''}
              </div>
            </div>
            <button
              onClick={() => (onStartWalk ? onStartWalk(availability) : undefined)}
              disabled={!onStartWalk}
              style={{ ...startBtn(true), padding: '8px 16px', fontSize: 13, cursor: onStartWalk ? 'pointer' : 'not-allowed' }}
            >
              {inProgress ? 'Resume walk' : 'Start walk'}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: v('radius', '8px'), background: v('ok-bg', '#e7efe4'), color: v('ok', '#2f6d3a'), fontSize: 13 }}
        >
          <span style={{ flex: 1 }}>{notice}</span>
          {onDismissNotice ? (
            <button onClick={onDismissNotice} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${v('border', '#e4ddcd')}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 10px',
              border: 'none',
              borderBottom: `2px solid ${tab === t.key ? v('accent', '#9B251B') : 'transparent'}`,
              background: 'transparent',
              color: v('fg', '#1a1a1a'),
              opacity: tab === t.key ? 1 : 0.65,
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}{' '}
            <span style={{ fontSize: 11, padding: '0 6px', borderRadius: 999, background: v('chip-bg', '#f0f0f0') }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'todo' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {!assigned.length ? <span style={{ fontSize: 13, opacity: 0.6 }}>Nothing assigned to you right now.</span> : null}
          {todo.inProgress.length ? (
            <section style={{ display: 'grid' }}>
              <span style={{ ...mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>In progress</span>
              {todo.inProgress.map((a) => (
                <div key={a.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.catalogueId}</div>
                    <div style={mono}>{a.build}{a.env ? ` · ${a.env}` : ''}</div>
                  </div>
                  {onStartAssignment ? (
                    <button onClick={() => onStartAssignment(a)} style={startBtn(true)}>
                      Resume
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {todo.groups.map((g, i) => {
            // The newest build is unfolded; older builds start folded so the list stays short.
            const isOpen = open[g.build] ?? i === 0
            const all = !!showAll[g.build]
            const rows = all ? g.assignments : g.assignments.slice(0, GROUP_PAGE)
            return (
              <section key={g.build} style={{ border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '10px'), padding: '0 10px' }}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [g.build]: !isOpen }))}
                  aria-expanded={isOpen}
                  style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: 8, padding: '8px 0', border: 'none', background: 'transparent', color: v('fg', '#1a1a1a'), cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ opacity: 0.6, width: 10 }}>{isOpen ? '▾' : '▸'}</span>
                  <strong style={{ fontSize: 13 }}>{g.build}</strong>
                  <span style={mono}>
                    {g.env ? `${g.env} · ` : ''}
                    {g.assignments.length} {g.assignments.length === 1 ? 'walk' : 'walks'}
                  </span>
                </button>
                {isOpen ? (
                  <>
                    {rows.map((a) => (
                      <div key={a.id} style={row}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{a.catalogueId}</div>
                        {onStartAssignment ? (
                          <button onClick={() => onStartAssignment(a)} style={startBtn(false)}>
                            Start
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {g.assignments.length > GROUP_PAGE ? (
                      <button
                        onClick={() => setShowAll((s) => ({ ...s, [g.build]: !all }))}
                        style={{ border: 'none', background: 'transparent', color: v('accent', '#9B251B'), padding: '6px 0 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        {all ? 'Show fewer' : `Show ${g.assignments.length - GROUP_PAGE} more`}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </section>
            )
          })}
          {!offered && !assigned.length ? <span style={{ fontSize: 13, opacity: 0.6 }}>No walk is offered for this build.</span> : null}
        </div>
      ) : null}

      {tab === 'completed' ? (
        <div style={{ display: 'grid' }}>
          {completed.length ? (
            completed.map((w) => (
              <div key={w.walkId} style={row}>
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
        </div>
      ) : null}

      {tab === 'issues' ? (
        <div style={{ display: 'grid' }}>
          {issues.length ? (
            issues.map((it) => (
              <div key={it.id} style={row}>
                <span style={{ fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }}>#{it.checkRef}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{it.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>raised on {it.build}</div>
                  {it.resolution ? (
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>
                      <b>{it.resolutionKind === 'clarified' ? 'Clarified:' : 'Fixed:'}</b> {it.resolution}
                    </div>
                  ) : null}
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
                  {it.resolvedBuild ? `${it.resolutionKind === 'clarified' ? 'Clarified' : 'Fixed'} ${it.resolvedBuild}` : STATUS_LABEL[it.status]}
                </span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 13, opacity: 0.6 }}>Nothing raised yet.</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

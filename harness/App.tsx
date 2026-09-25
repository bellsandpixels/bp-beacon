import { useMemo, useState } from 'react'
import {
  OnboardingPane,
  createLocalOnboardingStore,
  whatsNewSinceLastVisit,
  whatsNewSinceLastVisitByDate,
  type OnboardingStep,
  type TourStep,
  type OnboardingStorage,
} from '@bp/beacon'
import { CoachTour } from '@bp/beacon/tour'
import { VersionChangelog, parseChangelog } from '@bp/ui/app-frame'

// An in-memory onboarding store, so every preview starts fresh and nothing leaks to real localStorage.
function memoryStorage(): OnboardingStorage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

// A starting point: ike's first run (the four first-week rows + a rail tour), the design-gated content
// this harness exists to author. Edit freely; nothing here ships until it is pasted into a product mount.
const IKE_STEPS: OnboardingStep[] = [
  { id: 'pool', title: 'Fill your pool', description: 'Add the clips and segments your streams draw from.' },
  { id: 'segments', title: 'Build a segment', description: 'Group clips into a segment you can schedule.' },
  { id: 'schedule', title: 'Schedule a stream', description: 'Put a segment on the calendar to go live.' },
  { id: 'dashboard', title: 'Watch the dashboard', description: 'See a live stream and its health at a glance.' },
]
const IKE_TOUR: TourStep[] = [
  { target: 'pool', title: 'Your pool', body: 'Everything a stream can play lives here.' },
  { target: 'schedule', title: 'The schedule', body: 'A segment goes live when its slot arrives.' },
  { target: 'dashboard', title: 'The dashboard', body: 'Follow a live stream and step in if needed.' },
]
const SAMPLE_CHANGELOG = `## [0.9] - 2026-09-25
### Added
- Per-stream schedule editor.
### Fixed
- The pool no longer drops the last clip.

## [0.8] - 2026-09-10
### Added
- Segment thumbnails.
`

const RAIL = ['pool', 'segments', 'schedule', 'dashboard'] as const

export function App() {
  const [product, setProduct] = useState('ike')
  const [title, setTitle] = useState('Welcome to Iké')
  const [intro, setIntro] = useState('Four steps to your first live stream.')
  const [steps, setSteps] = useState<OnboardingStep[]>(IKE_STEPS)
  const [tour, setTour] = useState<TourStep[]>(IKE_TOUR)

  const [changelog, setChangelog] = useState(SAMPLE_CHANGELOG)
  const [lastSeen, setLastSeen] = useState('2026-09-10')
  const [whatsNewKey, setWhatsNewKey] = useState<'version' | 'date'>('date')

  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [nonce, setNonce] = useState(0)
  const [touring, setTouring] = useState(false)

  const store = useMemo(
    () => createLocalOnboardingStore({ product, storage: memoryStorage() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product, nonce],
  )

  const entries = useMemo(() => parseChangelog(changelog), [changelog])
  const news = useMemo(() => {
    const current = whatsNewKey === 'date' ? (entries.find((e) => e.date)?.date ?? '') : (entries.find((e) => e.version)?.version ?? '')
    return whatsNewKey === 'date'
      ? whatsNewSinceLastVisitByDate(entries as { version: string; date?: string }[], current, lastSeen)
      : whatsNewSinceLastVisit(entries as { version: string; date?: string }[], current, lastSeen)
  }, [entries, whatsNewKey, lastSeen])

  const snippet = `<BeaconFrame
  appFrame={AppFrame}
  parseChangelog={parseChangelog}
  product=${JSON.stringify(product)}
  appName=${JSON.stringify(title.replace(/^Welcome to /, ''))}
  version={version}
  changelogMarkdown={changelogMarkdown}
  help={help}
  whatsNewKey=${JSON.stringify(whatsNewKey)}
  steps={${JSON.stringify(steps, null, 2)}}
  tour={{ id: ${JSON.stringify(product + '-first-run')}, steps: ${JSON.stringify(tour, null, 2)} }}
  userKey={userKey}
  enabled={enabled}
  slots={{ /* renderFeedback, renderWalk, diagnostics */ }}
/>`

  return (
    <div className="harness">
      <header className="harness-bar">
        <strong>Beacon authoring harness</strong>
        <span className="muted">author, preview and validate the first run and What's new, then export</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setNonce((n) => n + 1)}>Reset preview</button>
        <button onClick={() => setWidth((w) => (w === 'desktop' ? 'mobile' : 'desktop'))}>
          {width === 'desktop' ? 'Show 375px' : 'Show desktop'}
        </button>
      </header>

      <div className="harness-body">
        {/* AUTHORING */}
        <section className="authoring">
          <h2>First run</h2>
          <label>Product key<input value={product} onChange={(e) => setProduct(e.target.value)} /></label>
          <label>Welcome title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Intro<textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} /></label>

          <h3>Checklist steps</h3>
          <RowEditor
            rows={steps}
            cols={['id', 'title', 'description']}
            onChange={setSteps}
            make={() => ({ id: 'new-step', title: 'New step', description: '' })}
          />

          <h3>Rail tour</h3>
          <RowEditor
            rows={tour}
            cols={['target', 'title', 'body']}
            onChange={setTour}
            make={() => ({ target: RAIL[0], title: 'New stop', body: '' })}
          />

          <h2>What's new</h2>
          <label>Key
            <select value={whatsNewKey} onChange={(e) => setWhatsNewKey(e.target.value as 'version' | 'date')}>
              <option value="version">version</option>
              <option value="date">date</option>
            </select>
          </label>
          <label>Last seen ({whatsNewKey})<input value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} /></label>
          <label>CHANGELOG.md<textarea rows={10} value={changelog} onChange={(e) => setChangelog(e.target.value)} /></label>
          <p className={news.shouldOpen ? 'ok' : 'muted'}>
            What's new would {news.shouldOpen ? 'OPEN once' : 'stay closed'}
            {news.firstVisit ? ' (first visit: records the baseline, shows nothing)' : ''}
            {news.entries.length ? `. New: ${news.entries.map((e) => e.version).join(', ')}` : ''}
          </p>

          <h2>Export</h2>
          <textarea className="snippet" readOnly rows={12} value={snippet} onFocus={(e) => e.currentTarget.select()} />
        </section>

        {/* PREVIEW */}
        <section className="preview">
          <div className={`device device-${width}`}>
            {/* a mock product chrome, so the rail tour has anchors to point at */}
            <div className="mock-rail">
              {RAIL.map((r) => (
                <div key={r} data-beacon-tour={r} className="mock-rail-item">{r}</div>
              ))}
            </div>

            <div className="mock-surface">
              <div className="preview-block">
                <div className="preview-label">First run (OnboardingPane + CoachTour)</div>
                <OnboardingPane
                  adapter={store}
                  steps={steps}
                  title={title}
                  intro={intro}
                  manualComplete
                  onClose={() => setNonce((n) => n + 1)}
                  onStartTour={tour.length ? () => setTouring(true) : undefined}
                />
              </div>

              <div className="preview-block">
                <div className="preview-label">What's new (VersionChangelog)</div>
                <div className="wn-frame">
                  <VersionChangelog open onClose={() => {}} entries={entries} appName={product} version={undefined} />
                </div>
              </div>
            </div>

            {touring && (
              <CoachTour adapter={store} tourId="preview" steps={tour} onClose={() => setTouring(false)} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// A tiny generic row editor for the steps/tour tables.
function RowEditor<T extends Record<string, string>>({
  rows,
  cols,
  onChange,
  make,
}: {
  rows: T[]
  cols: (keyof T & string)[]
  onChange: (next: T[]) => void
  make: () => T
}) {
  const set = (i: number, k: keyof T & string, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div className="rows">
      {rows.map((r, i) => (
        <div className="row" key={i}>
          {cols.map((c) => (
            <input key={c} placeholder={c} value={r[c] ?? ''} onChange={(e) => set(i, c, e.target.value)} />
          ))}
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} title="remove">x</button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, make()])}>+ add</button>
    </div>
  )
}

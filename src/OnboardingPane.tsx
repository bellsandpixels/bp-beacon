// The shared, design-system-agnostic Beacon FIRST-RUN pane: a welcome card plus a "get started" checklist
// the product declares. Themed entirely by --beacon-* CSS variables (neutral fallbacks), like FeedbackPane
// and WalkPane. The user always has two ways out: "Skip for now" (the pane may come back later while the
// checklist is unfinished) and a "Don't show me this again" toggle (nothing opens by itself again).
// Whether to show the pane automatically is the host's call via shouldAutoOpenOnboarding; the pane itself
// renders whenever it is mounted, so a user can always reopen it by hand.

import { useEffect, useId, useState } from 'react'
import type { OnboardingAdapter, OnboardingState, OnboardingStep } from './onboardingTypes.js'
import { isChecklistDone } from './onboardingStore.js'

export interface OnboardingPaneProps {
  adapter: OnboardingAdapter
  steps: readonly OnboardingStep[]
  title?: string // default "Welcome"
  intro?: string // one or two plain sentences about what the product does for them
  onClose: () => void
  // Offer a guided tour from the welcome card (the host mounts CoachTour when called).
  onStartTour?: () => void
  // Let the user tick a step by hand. Off by default: steps are ticked when the real action happens.
  manualComplete?: boolean
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

const buttonBase: React.CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  padding: '7px 12px',
  borderRadius: v('radius', '8px'),
  cursor: 'pointer',
}
const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: v('accent', '#2563eb'),
  color: v('accent-fg', '#fff'),
  border: '1px solid transparent',
}
const quietButton: React.CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  color: v('fg', 'inherit'),
  border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
}

export function OnboardingPane({
  adapter,
  steps,
  title = 'Welcome',
  intro,
  onClose,
  onStartTour,
  manualComplete = false,
}: OnboardingPaneProps) {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toggleId = useId()

  useEffect(() => {
    let live = true
    adapter
      .load()
      .then((s) => live && setState(s))
      .catch(() => live && setError('Could not load your progress.'))
    return () => {
      live = false
    }
  }, [adapter])

  async function run(fn: () => Promise<OnboardingState>) {
    setError(null)
    try {
      setState(await fn())
    } catch {
      setError('That did not save. Try again.')
    }
  }

  async function skip() {
    try {
      await adapter.skip()
    } catch {
      // Skipping must never trap the user in the pane; close even if the record did not save.
    }
    onClose()
  }

  const done = state ? steps.filter((s) => state.completed.includes(s.id)).length : 0
  const allDone = state ? isChecklistDone(state, steps) : false

  return (
    <div style={{ display: 'grid', gap: 14, color: v('fg', 'inherit'), fontFamily: v('font', 'inherit') }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
        {intro ? <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{intro}</p> : null}
      </header>

      {steps.length ? (
        <section aria-label="Get started" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.7 }}>
            <span>Get started</span>
            <span aria-live="polite">
              {done} of {steps.length} done
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={done}
            aria-label="Checklist progress"
            style={{ height: 4, borderRadius: 2, background: v('border', 'rgba(127,127,127,.25)'), overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${steps.length ? (done / steps.length) * 100 : 0}%`,
                height: '100%',
                background: v('accent', '#2563eb'),
                transition: 'width .2s ease',
              }}
            />
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {steps.map((step) => {
              const ticked = !!state?.completed.includes(step.id)
              return (
                <li
                  key={step.id}
                  data-beacon-onboarding-step={step.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 10,
                    alignItems: 'start',
                    padding: v('pad', '10px'),
                    border: `1px solid ${v('border', 'rgba(127,127,127,.25)')}`,
                    borderRadius: v('radius', '8px'),
                    background: v('field-bg', 'transparent'),
                  }}
                >
                  {manualComplete ? (
                    <input
                      type="checkbox"
                      checked={ticked}
                      disabled={ticked || !state}
                      aria-label={`Mark "${step.title}" done`}
                      onChange={() => void run(() => adapter.completeStep(step.id))}
                      style={{ marginTop: 2 }}
                    />
                  ) : (
                    <span aria-hidden="true" style={{ width: 16, textAlign: 'center', color: v('accent', '#2563eb') }}>
                      {ticked ? '✓' : '○'}
                    </span>
                  )}
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 14, textDecoration: ticked ? 'line-through' : 'none', opacity: ticked ? 0.6 : 1 }}>
                      {step.title}
                      {!manualComplete ? <span style={visuallyHidden}>{ticked ? ' (done)' : ' (to do)'}</span> : null}
                    </span>
                    {step.description ? <span style={{ fontSize: 12, opacity: 0.7 }}>{step.description}</span> : null}
                  </div>
                  {step.action && !ticked ? (
                    <button type="button" style={quietButton} onClick={step.action.onClick}>
                      {step.action.label}
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {error ? (
        <div role="alert" style={{ fontSize: 12, color: v('error', '#b91c1c') }}>
          {error}
        </div>
      ) : null}

      <footer style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {allDone ? (
            <button type="button" style={primaryButton} onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button type="button" style={quietButton} onClick={() => void skip()}>
                Skip for now
              </button>
              {onStartTour ? (
                <button type="button" style={primaryButton} onClick={onStartTour}>
                  Show me around
                </button>
              ) : null}
            </>
          )}
        </div>
        <label htmlFor={toggleId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, opacity: 0.8, cursor: 'pointer' }}>
          <input
            id={toggleId}
            type="checkbox"
            checked={!!state?.suppressed}
            disabled={!state}
            onChange={(e) => {
              const suppressed = e.currentTarget.checked
              void run(() => adapter.setSuppressed(suppressed))
            }}
          />
          Don't show me this again
        </label>
      </footer>
    </div>
  )
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

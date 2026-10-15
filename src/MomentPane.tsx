// The shared, design-system-agnostic first-time MOMENT explainer: a small modal the Beacon opens the first time
// the user does something that needs explaining (see moments.ts). Themed entirely by --beacon-* CSS variables
// with neutral fallbacks, like OnboardingPane. Accessible: role="dialog" + aria-modal, labelled by its title,
// focus lands on the close button, and Escape or a press outside the card closes it. The backdrop is visual only: a
// press outside the card closes the explainer AND reaches what was pressed (pointer-events pass through the scrim), so
// the explainer never silently eats the user's next action (toudai F16: a Save explainer swallowed the first Publish). A repeating moment carries a
// "Don't show this again" checkbox; a once-only moment needs none (closing it is final).

import { useEffect, useId, useRef, useState } from 'react'
import { isOutsideCard, momentParagraphs } from './moments.js'
import type { Moment } from './onboardingTypes.js'

export interface MomentPaneProps {
  moment: Moment
  // Called once when the explainer closes, with whether "Don't show this again" was ticked.
  onClose: (dontShowAgain: boolean) => void
}

const v = (name: string, fallback: string) => `var(--beacon-${name}, ${fallback})`

export function MomentPane({ moment, onClose }: MomentPaneProps) {
  const [dontShow, setDontShow] = useState(false)
  const okRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // The latest checkbox value for the Escape handler, without re-binding it on every toggle.
  const dontShowRef = useRef(dontShow)
  dontShowRef.current = dontShow

  useEffect(() => {
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(dontShowRef.current)
    }
    // Capture phase, never preventDefault: the press closes the explainer and still lands on its target.
    const onPointer = (e: PointerEvent) => {
      if (isOutsideCard(e.target, cardRef.current)) onClose(dontShowRef.current)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [onClose])

  return (
    <div
      data-beacon-moment={moment.id}
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: v('moment-z', '60'),
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '10vh 16px',
        background: v('moment-scrim', 'rgba(15,17,21,.4)'),
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 448,
          boxSizing: 'border-box',
          display: 'grid',
          gap: 12,
          padding: 24,
          color: v('fg', '#111'),
          fontFamily: v('font', 'inherit'),
          background: v('bg', v('field-bg', '#fff')),
          border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
          borderRadius: v('radius', '8px'),
          boxShadow: '0 12px 32px rgba(0,0,0,.18)',
        }}
      >
        {moment.label ? (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: v('accent', '#2563eb') }}>
            {moment.label}
          </p>
        ) : null}
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          {moment.title}
        </h2>
        {momentParagraphs(moment.body).map((p) => (
          <p key={p} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
            {p}
          </p>
        ))}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: moment.repeat ? 'space-between' : 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          {moment.repeat ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: 0.85 }}>
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              Don&apos;t show this again
            </label>
          ) : null}
          <button
            ref={okRef}
            type="button"
            onClick={() => onClose(dontShow)}
            style={{
              font: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: v('radius', '8px'),
              cursor: 'pointer',
              background: v('accent', '#2563eb'),
              color: v('accent-fg', '#fff'),
              border: '1px solid transparent',
            }}
          >
            {moment.ok ?? 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}

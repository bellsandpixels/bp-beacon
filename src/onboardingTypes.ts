// First-run / onboarding types: the contract a product's first-run experience runs on. Design-system
// agnostic like the feedback and walk contracts. The OnboardingAdapter is async so a server-backed store
// (per-user, cross-device) can replace the default local one without a consumer change.
//
// The three user choices are deliberately distinct:
//   - SKIP ("not now"): closes the welcome pane; it may resurface after a quiet period while the checklist
//     is unfinished (OnboardingPolicy.resurfaceAfterMs). Skipping a TOUR ends that tour for good.
//   - DON'T SHOW ME THIS AGAIN (suppressed): nothing auto-opens again, neither the pane nor any tour. The
//     user can still open onboarding by hand from wherever the host offers it.
//   - The seen version: what the user last saw, so What's new opens once per upgrade, not every visit.

export interface OnboardingStep {
  id: string
  title: string
  description?: string
  // An optional call to action the host wires (e.g. "Create your first report" navigates there). The
  // step is ticked when the host calls adapter.completeStep(id), typically when the real action happens.
  // close: true closes the pane after the click, for an action that takes the user somewhere (a create dialog,
  // another screen) the open pane would otherwise sit on top of. Leave it off for an action done in place (copy a
  // link), so the user sees the step tick.
  action?: { label: string; onClick: () => void; close?: boolean }
}

export type TourOutcome = 'completed' | 'skipped'

export interface OnboardingState {
  completed: string[] // checklist step ids the user has done
  skippedAt?: string // ISO time of the last "Skip" on the welcome pane
  suppressed: boolean // "Don't show me this again"
  tours: Record<string, TourOutcome> // one-shot tours already finished or skipped
  lastSeenVersion?: string // the app version the user last saw (drives What's new since last visit)
  // First-time moment explainers already dealt with (see Moment below). Optional so an adapter written before
  // moments existed still type-checks; the default store always fills it.
  moments?: Record<string, MomentOutcome>
}

export interface OnboardingAdapter {
  load(): Promise<OnboardingState>
  completeStep(stepId: string): Promise<OnboardingState>
  skip(): Promise<OnboardingState>
  setSuppressed(suppressed: boolean): Promise<OnboardingState>
  finishTour(tourId: string, outcome: TourOutcome): Promise<OnboardingState>
  markVersionSeen(version: string): Promise<OnboardingState>
  // Record a first-time moment explainer's outcome. Optional so an older adapter still type-checks; without it
  // a moment still shows, it just is not remembered past this visit.
  recordMoment?(momentId: string, outcome: MomentOutcome): Promise<OnboardingState>
  reset(): Promise<OnboardingState>
  // Optional change feed. A host ticks steps from its own real actions (a save, a publish) while the pane is
  // already mounted, so the pane and the hook subscribe to show the tick live instead of a stale "0 of 2" until a
  // reload (found on the toudai Studio walk, 2026-09-27). Returns an unsubscribe. Absent = read-on-mount only.
  subscribe?(listener: (state: OnboardingState) => void): () => void
}

export interface OnboardingPolicy {
  // How long a "Skip" keeps the welcome pane closed while the checklist is unfinished. Default 7 days;
  // Infinity makes Skip permanent (then it behaves like "don't show again" for the pane only).
  resurfaceAfterMs?: number
}

export interface TourStep {
  // The [data-beacon-tour="<target>"] anchor on the host page. A step whose anchor is not on the page is
  // passed over, so a tour survives a feature being hidden for this user.
  target: string
  title: string
  body?: string
}

// A first-time MOMENT: a short explainer the product raises the first time the user does something that needs
// explaining (the first save, the first publish), announced from wherever the action happens with
// announceMoment(id). It rides the same OnboardingState as the welcome and the tours, so "Don't show me this
// again" on the welcome silences every moment too.
//
//   - repeat false (default): shown ONCE per user. Closing it records 'seen' and it never shows again.
//   - repeat true: shown once per visit until the user ticks "Don't show this again" in the explainer, which
//     records 'hidden'. For a moment the product wants repeated until the user says they have it.
export type MomentOutcome = 'seen' | 'hidden'

export interface Moment {
  id: string
  label?: string // a small kicker above the title, e.g. "Saved"
  title: string
  body: string | readonly string[] // paragraphs; a string splits on blank lines
  ok?: string // the close button, default "Got it"
  repeat?: boolean
}

// A tour the product declares beyond the welcome pane's "Show me around" tour. With autoStart, the Beacon starts it
// BY ITSELF, once, the first time its first step's anchor is on the page (say the editor opens), unless the user
// already finished or skipped it, or chose "Don't show me this again". The host wires no event: marking the
// anchor is the whole integration. Without autoStart it runs only when the host calls startTour(id).
export interface BeaconTour {
  id: string
  steps: readonly TourStep[]
  autoStart?: boolean
}

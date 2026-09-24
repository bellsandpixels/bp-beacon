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
  action?: { label: string; onClick: () => void }
}

export type TourOutcome = 'completed' | 'skipped'

export interface OnboardingState {
  completed: string[] // checklist step ids the user has done
  skippedAt?: string // ISO time of the last "Skip" on the welcome pane
  suppressed: boolean // "Don't show me this again"
  tours: Record<string, TourOutcome> // one-shot tours already finished or skipped
  lastSeenVersion?: string // the app version the user last saw (drives What's new since last visit)
}

export interface OnboardingAdapter {
  load(): Promise<OnboardingState>
  completeStep(stepId: string): Promise<OnboardingState>
  skip(): Promise<OnboardingState>
  setSuppressed(suppressed: boolean): Promise<OnboardingState>
  finishTour(tourId: string, outcome: TourOutcome): Promise<OnboardingState>
  markVersionSeen(version: string): Promise<OnboardingState>
  reset(): Promise<OnboardingState>
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

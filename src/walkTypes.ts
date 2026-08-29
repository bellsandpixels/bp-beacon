// The shared Beacon VALIDATION WALK contract, the walk analog of the feedback contract in types.ts.
// Design-system-agnostic, exactly like FeedbackPane: themed by --beacon-* CSS variables the host sets.
// The validation walk becomes a fourth Beacon affordance; @bp/ui/app-frame mounts the walk pane through a
// slot mirroring renderFeedback. Assume-pass: a walked surface's checks pass unless one is flagged with a
// note. Coverage (which surfaces nobody walked) is the load-bearing signal. See the validation-motion plan
// (T1) and bp-qa validation-checklist.md (the record FORMAT the walk renders downstream).

import type { FeedbackStatus } from './types.js'

// ---- The catalogue: the test script (surfaces + checks + severity floors), the shape of
// toudai/qa/validation-checks.json. The host supplies it as a build asset so the walk always matches the
// running build. ----

// A check's severity FLOOR, authored once in the catalogue by someone who knows the stakes. A reviewer may
// raise a debt defect to blocker, never lower a blocker. Absent = 'debt'.
export type CheckSeverity = 'blocker' | 'debt'

export interface WalkCheck {
  n: number // stable check number; the identity a defect and a resolution key off
  text: string
  severity?: CheckSeverity // catalogue floor; defaults to 'debt'
}

export interface WalkSurface {
  key: string // stable surface key; walked-ness is recorded against this
  title: string
  route?: string // the in-app route this surface is judged at
  checks: WalkCheck[]
}

export interface WalkArea {
  title: string
  note?: string
  surfaces: WalkSurface[]
}

export interface ValidationCatalogue {
  catalogueId: string // identifies the catalogue for this build
  target: string // the dev/test surface URL the walk is run against
  themes?: string[] // e.g. ["light", "dark"]
  areas: WalkArea[]
}

// ---- Live walk state (assume-pass). walked is per surface key; defects is per check number -> note.
// An empty note is an in-progress flag, NOT a recorded defect (mirrors the bp-qa record rule). ----
export interface WalkState {
  walked: Record<string, boolean>
  defects: Record<number, string>
}

// ---- Review shapes (the Validation-hub zones). ----

// A completed walk (the "Completed" zone): coverage N / M + how many were flagged.
export interface WalkSummary {
  walkId: string
  build: string // Major.Minor.Build the walk was run on
  env: string // the ring: "uat" | "alpha" | ...
  submittedOn?: string // ISO timestamp the walk record was written
  coverage: { walked: number; total: number }
  flagged: number
}

// A raised issue with its live disposition (the "My issues" zone). status maps onto the post-D8 intake
// disposition set; resolvedBuild is the build on the REPORTER'S OWN ring that first carried the fix
// (a distinct "Fixed in build X" state, never a bare Closed).
export interface WalkIssue {
  id: string // opaque intake id
  reference?: string // human ref, e.g. "INT-0042"
  checkRef: number // the catalogue check number this issue is a flag on
  surfaceKey?: string
  title: string
  status: FeedbackStatus
  resolvedBuild?: string // e.g. "0.5.1901" when the fix shipped to the reporter's ring
  build: string // the build the issue was raised on
}

// ---- Identity + availability (adapter-owned auth). ----
export interface WalkIdentity {
  authenticated: boolean
  name?: string // display name once authenticated; omitted when anonymous/unauthed
}

// Whether a walk is offered for this viewer's build/cohort, and the build/env/catalogue context. null when
// no walk applies (the affordance stays hidden).
export interface WalkAvailability {
  offered: boolean
  build: string
  env: string
  catalogueId: string
}

// ---- The backend-agnostic walk adapter, the walk analog of FeedbackAdapter. The host wires it (a shared
// portal implementation, or a scaffold); the walk pane calls it. authenticate / listMine / listMyIssues are
// the authenticated (cohort tester) shape. The kit stays free of any specific backend. ----
export interface WalkAdapter {
  // Adapter-owned auth: reuse the host's sign-in (e.g. the portal magic link). Resolves the identity.
  authenticate: () => Promise<WalkIdentity>
  // The current identity without prompting (drives whether the hub shows or the sign-in does).
  identity: () => Promise<WalkIdentity>
  // Is a walk offered for THIS build/cohort? Drives the affordance + the launch nudge. null = none.
  available: () => Promise<WalkAvailability | null>
  // Start (or resume) this viewer's walk for the current build; returns the live state.
  start: () => Promise<WalkState>
  // One-tap coverage: mark a surface walked (or unwalked).
  markWalked: (surfaceKey: string, walked: boolean) => Promise<void>
  // Flag a check -> upserts this viewer's intake item for the check (check-ref + build/env), reusing the
  // beacon-signal path. Idempotent by checkRef within the walk: re-calling updates the note in place and
  // returns the same ref, never a duplicate item. Callers sync once (on blur / at submit), not per keystroke.
  flag: (input: { checkRef: number; note: string }) => Promise<{ id: string; reference?: string }>
  // Clear a flag (before it is submitted).
  clearFlag: (checkRef: number) => Promise<void>
  // Submit the completed coverage; writes the walk record and returns its summary.
  submit: () => Promise<WalkSummary>
  // Review: this viewer's past walks (the "Completed" zone).
  listMine: () => Promise<WalkSummary[]>
  // Review: this viewer's raised issues with their live dispositions (the "My issues" zone).
  listMyIssues: () => Promise<WalkIssue[]>
}

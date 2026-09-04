// The shared Beacon feedback contract. This is the design-system-agnostic core that fudemoji and ike each
// re-ported off @bp/ui; it is now extracted here (decision #63) so every product speaks ONE contract. The
// wire envelope is canonical in client-portal docs/beacon-anon-ingest-spec.md; a contract test in
// client-portal asserts this SDK's envelope matches what /api/beacon-signal accepts.

// The kinds an anonymous reporter may file (the endpoint accepts bug | idea).
export type FeedbackKind = 'bug' | 'idea'

// Triage-disposition status (mirrors the migrated @bp/ui app-frame contract). A host maps its backend
// lifecycle onto these; the pane renders a label per status. Only used when the host supplies the
// (optional) reporter lifecycle; the anonymous submit-only path never renders a reports list.
export type FeedbackStatus =
  | 'submitted' // received, awaiting triage
  | 'triaging' // staff are looking at it
  | 'accepted' // approved / will be actioned
  | 'routed' // turned into downstream work (issue / ticket / roadmap)
  | 'declined' // rejected
  | 'duplicate'
  | 'parked'
  | 'closed' // reporter-closed (or otherwise terminal)

export interface FeedbackReport {
  id: string // opaque backend id (NOT a GitHub issue number)
  reference?: string // human reference shown to the reporter, e.g. "INT-0042"
  title: string
  kind: FeedbackKind
  status: FeedbackStatus
  createdAt?: string
}

// The consented, allow-listed auto-context [D3] attached ONLY when the reporter opts in. This is EXACTLY
// the client-safe allow-list /api/beacon-signal accepts - NO stable id, no IP, no full user-agent, no
// scraped state. Keep in lockstep with the native (Android/iOS) client, which sends the same shape.
export interface BeaconContext {
  appName: string
  appVersion: string
  env: string // coarse ring: "production" | "alpha" | "dev"
  platform: 'web'
  device: string // coarse form factor ONLY: "phone" | "tablet" | "desktop" (never a model, never dimensions)
  os: string // coarse OS family ONLY: "win" | "ios" | "android" | "mac" | "linux" (never a build/patch)
  osMajor: string // OS family + major (e.g. "iOS 18"); the version detail behind `os`. Never a raw UA
  route: string // in-app route PATH only; query + fragment stripped
  locale: string // e.g. "en-US"
}

// The exact envelope POSTed to /api/beacon-signal. `hp` is the honeypot (always empty from a real client);
// `context` rides ONLY on explicit consent; `product` is set by the host. This mirrors the native envelope.
export interface BeaconEnvelope {
  product: string
  kind: FeedbackKind
  title: string
  details: string
  consent: boolean
  clientReportId?: string
  hp: string
  context?: BeaconContext
  // Optional reporter contact (<= 200 chars). Explicit ONLY: either the reporter typed it, or the host
  // passed a known identity the reporter could see and clear (BeaconAdapterConfig.resolveIdentity). The
  // server maps it to bp_contact ("never auto-derived") and never infers it from IP/auth. Rides
  // independently of the D3 consent gate - it is primary content the reporter controls, not auto-context.
  contact?: string
}

// Backend-agnostic feedback adapter. The host wires submit (via createBeaconAdapter) and MAY supply the
// optional reporter lifecycle. The anonymous intake path exposes none, so list/confirm/reopen stay
// undefined and the reports view is hidden.
export interface FeedbackAdapter {
  submit: (input: {
    kind: FeedbackKind
    title: string
    details: string
    consent: boolean
    // Optional reporter contact. A string (including '') is the caller's explicit value and wins; omit it
    // entirely to let a host-configured identity resolver fill it (see BeaconAdapterConfig.resolveIdentity).
    contact?: string
  }) => Promise<{ id: string; reference?: string }>
  list?: () => Promise<FeedbackReport[]>
  confirm?: (id: string) => Promise<void>
  reopen?: (id: string) => Promise<void>
}

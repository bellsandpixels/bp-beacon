// @bp/beacon - the shared Bells & Pixels Beacon feedback SDK (decision #63).
//
// The design-system-agnostic web FeedbackPane + the canonical /api/beacon-signal adapter that fudemoji,
// toudai, and ike converge onto. The wire envelope is canonical in client-portal
// docs/beacon-anon-ingest-spec.md; a contract test in client-portal asserts this SDK's envelope matches it.
//
// Host wiring (web):
//   const adapter = createBeaconAdapter({
//     endpoint: '/api/feedback',            // same-origin forwarder, or the portal endpoint directly
//     product: 'toudai',
//     appName: 'Toudai Studio', appVersion: '0.1.0', env: 'production',
//   })
//   <FeedbackPane adapter={adapter} gatherContext={() => gatherWebContext({ appName, appVersion, env })} />

export type {
  FeedbackKind,
  FeedbackStatus,
  FeedbackReport,
  FeedbackAdapter,
  BeaconContext,
  BeaconEnvelope,
  BeaconAttachmentRef,
} from './types.js'
export { gatherWebContext, osMajorFromUA, osFromUA, deviceFromUA, type WebContextConfig } from './diagnostics.js'
export { createBeaconAdapter, buildEnvelope, type BeaconAdapterConfig } from './adapter.js'
export {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_IMAGE_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  validateAttachmentFile,
} from './attachments.js'
export { FeedbackPane, type FeedbackPaneProps } from './FeedbackPane.js'

// The validation walk (T1): the walk analog of feedback. The Validation-hub pane + the WalkAdapter
// contract + the catalogue types, design-system-agnostic like FeedbackPane. @bp/ui/app-frame mounts the
// pane through a walk affordance slot mirroring renderFeedback. The assume-pass tap-to-tick walk surface
// and the WalkAdapter implementation land in later phases.
export type {
  CheckSeverity,
  WalkCheck,
  WalkSurface,
  WalkArea,
  ValidationCatalogue,
  WalkState,
  WalkSummary,
  WalkIssue,
  WalkIdentity,
  WalkAvailability,
  WalkAssignmentSummary,
  WalkInProgress,
  WalkAdapter,
  WalkStartOptions,
} from './walkTypes.js'
export { WalkPane, type WalkPaneProps } from './WalkPane.js'
export { WalkSurfacePane, type WalkSurfacePaneProps } from './WalkSurfacePane.js'
export { deriveVerdict, surfacesOf, checkByNumber, type Verdict, type VerdictLabel } from './walkVerdict.js'
export { createStubWalkAdapter, type StubWalkOptions } from './walkAdapter.js'
// The portal-backed WalkAdapter (T3): maps the WalkAdapter interface onto the client-portal /api/walk/*
// endpoints. The one client implementation a portal-backed product wires (the stub above is for demos).
export { createWalkAdapter, type WalkAdapterConfig } from './walkClient.js'

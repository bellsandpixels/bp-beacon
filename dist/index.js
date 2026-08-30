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
export { gatherWebContext, osMajorFromUA, osFromUA, deviceFromUA } from './diagnostics.js';
export { createBeaconAdapter, buildEnvelope } from './adapter.js';
export { FeedbackPane } from './FeedbackPane.js';
export { WalkPane } from './WalkPane.js';
export { WalkSurfacePane } from './WalkSurfacePane.js';
export { deriveVerdict, surfacesOf, checkByNumber } from './walkVerdict.js';
export { createStubWalkAdapter } from './walkAdapter.js';
// The portal-backed WalkAdapter (T3): maps the WalkAdapter interface onto the client-portal /api/walk/*
// endpoints. The one client implementation a portal-backed product wires (the stub above is for demos).
export { createWalkAdapter } from './walkClient.js';

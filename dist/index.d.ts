export type { FeedbackKind, FeedbackStatus, FeedbackReport, FeedbackAdapter, BeaconContext, BeaconEnvelope, } from './types.js';
export { gatherWebContext, osMajorFromUA, type WebContextConfig } from './diagnostics.js';
export { createBeaconAdapter, buildEnvelope, type BeaconAdapterConfig } from './adapter.js';
export { FeedbackPane, type FeedbackPaneProps } from './FeedbackPane.js';

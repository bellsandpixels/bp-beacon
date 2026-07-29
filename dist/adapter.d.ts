import type { BeaconEnvelope, FeedbackAdapter } from './types.js';
import { type WebContextConfig } from './diagnostics.js';
export interface BeaconAdapterConfig extends WebContextConfig {
    endpoint: string;
    product: string;
    fetchImpl?: typeof fetch;
}
export declare function buildEnvelope(cfg: BeaconAdapterConfig, input: {
    kind: BeaconEnvelope['kind'];
    title: string;
    details: string;
    consent: boolean;
}): BeaconEnvelope;
export declare function createBeaconAdapter(cfg: BeaconAdapterConfig): FeedbackAdapter;

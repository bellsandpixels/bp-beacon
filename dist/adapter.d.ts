import type { BeaconEnvelope, FeedbackAdapter, BeaconAttachmentRef } from './types.js';
import { type WebContextConfig } from './diagnostics.js';
export interface BeaconAdapterConfig extends WebContextConfig {
    endpoint: string;
    product: string;
    resolveIdentity?: () => string | undefined;
    ticketEndpoint?: string;
    fetchImpl?: typeof fetch;
}
export declare function buildEnvelope(cfg: BeaconAdapterConfig, input: {
    kind: BeaconEnvelope['kind'];
    title: string;
    details: string;
    consent: boolean;
    contact?: string;
    attachments?: BeaconAttachmentRef[];
    clientReportId?: string;
}): BeaconEnvelope;
export declare function createBeaconAdapter(cfg: BeaconAdapterConfig): FeedbackAdapter;

import type { WalkAdapter, WalkIdentity } from './walkTypes.js';
export interface WalkAdapterConfig {
    endpoint: string;
    cohortId: string;
    catalogueId: string;
    build?: string;
    env?: string;
    platform?: string;
    total?: number;
    authenticate?: () => Promise<WalkIdentity>;
    resolveIdentity?: () => Promise<WalkIdentity>;
    identityEndpoint?: string;
    titleForCheck?: (checkRef: number) => string | undefined;
    fetchImpl?: typeof fetch;
}
export declare function createWalkAdapter(cfg: WalkAdapterConfig): WalkAdapter;

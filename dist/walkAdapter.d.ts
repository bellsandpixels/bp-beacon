import type { WalkAdapter, ValidationCatalogue } from './walkTypes.js';
export interface StubWalkOptions {
    build?: string;
    env?: string;
    name?: string;
    authenticated?: boolean;
}
export declare function createStubWalkAdapter(catalogue: ValidationCatalogue, opts?: StubWalkOptions): WalkAdapter;

import type { ValidationCatalogue, WalkAdapter, WalkStartOptions } from './walkTypes.js';
export interface WalkSurfacePaneProps {
    catalogue: ValidationCatalogue;
    adapter: WalkAdapter;
    build?: string;
    env?: string;
    startOpts?: WalkStartOptions;
    onDone?: (summary: {
        walkId: string;
    }) => void;
}
export declare function WalkSurfacePane({ catalogue, adapter, build, env, startOpts, onDone }: WalkSurfacePaneProps): import("react").JSX.Element;

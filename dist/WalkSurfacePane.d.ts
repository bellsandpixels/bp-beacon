import type { ValidationCatalogue, WalkAdapter } from './walkTypes.js';
export interface WalkSurfacePaneProps {
    catalogue: ValidationCatalogue;
    adapter: WalkAdapter;
    build?: string;
    env?: string;
    onDone?: (summary: {
        walkId: string;
    }) => void;
}
export declare function WalkSurfacePane({ catalogue, adapter, build, env, onDone }: WalkSurfacePaneProps): import("react").JSX.Element;

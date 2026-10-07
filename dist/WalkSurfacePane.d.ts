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
    onExit?: () => void;
    title?: string;
    links?: WalkLinks;
}
/** Host-supplied URLs for the walk toolbar. All point at the SAME walk, so progress carries over. */
export interface WalkLinks {
    popOut?: string;
    review?: string;
    handoff?: string;
}
export declare function WalkSurfacePane({ catalogue, adapter, build, env, startOpts, onDone, onExit, title, links }: WalkSurfacePaneProps): import("react").JSX.Element;

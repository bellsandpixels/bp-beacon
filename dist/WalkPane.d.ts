import type { WalkAdapter, WalkAvailability } from './walkTypes.js';
export interface WalkPaneProps {
    adapter: WalkAdapter;
    onStartWalk?: (availability: WalkAvailability) => void;
}
export declare function WalkPane({ adapter, onStartWalk }: WalkPaneProps): import("react").JSX.Element;

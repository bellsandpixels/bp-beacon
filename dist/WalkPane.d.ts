import type { WalkAdapter, WalkAssignmentSummary, WalkAvailability } from './walkTypes.js';
export interface WalkPaneProps {
    adapter: WalkAdapter;
    onStartWalk?: (availability: WalkAvailability) => void;
    onStartAssignment?: (assignment: WalkAssignmentSummary) => void;
}
export declare function WalkPane({ adapter, onStartWalk, onStartAssignment }: WalkPaneProps): import("react").JSX.Element;

import type { WalkAdapter, WalkAssignmentSummary, WalkAvailability } from './walkTypes.js';
export interface WalkPaneProps {
    adapter: WalkAdapter;
    onStartWalk?: (availability: WalkAvailability) => void;
    onStartAssignment?: (assignment: WalkAssignmentSummary) => void;
    notice?: string | null;
    onDismissNotice?: () => void;
}
export declare function WalkPane({ adapter, onStartWalk, onStartAssignment, notice, onDismissNotice }: WalkPaneProps): import("react").JSX.Element;

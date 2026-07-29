import type { FeedbackAdapter, BeaconContext } from './types.js';
export interface FeedbackPaneProps {
    adapter: FeedbackAdapter;
    gatherContext?: () => BeaconContext;
    onDone?: (result: {
        id: string;
        reference?: string;
    }) => void;
}
export declare function FeedbackPane({ adapter, gatherContext, onDone }: FeedbackPaneProps): import("react").JSX.Element;

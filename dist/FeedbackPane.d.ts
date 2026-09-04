import type { FeedbackAdapter, BeaconContext } from './types.js';
export interface FeedbackPaneProps {
    adapter: FeedbackAdapter;
    gatherContext?: () => BeaconContext;
    resolveIdentity?: () => string | undefined;
    onDone?: (result: {
        id: string;
        reference?: string;
    }) => void;
}
export declare function FeedbackPane({ adapter, gatherContext, resolveIdentity, onDone }: FeedbackPaneProps): import("react").JSX.Element;

import type { Moment } from './onboardingTypes.js';
export interface MomentPaneProps {
    moment: Moment;
    onClose: (dontShowAgain: boolean) => void;
}
export declare function MomentPane({ moment, onClose }: MomentPaneProps): import("react").JSX.Element;

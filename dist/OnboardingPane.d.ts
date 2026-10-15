import type { OnboardingAdapter, OnboardingState, OnboardingStep } from './onboardingTypes.js';
export interface OnboardingPaneProps {
    adapter: OnboardingAdapter;
    steps: readonly OnboardingStep[];
    title?: string;
    intro?: string;
    onClose: () => void;
    onStartTour?: () => void;
    manualComplete?: boolean;
    onStateChange?: (state: OnboardingState) => void;
}
export declare function OnboardingPane({ adapter, steps, title, intro, onClose, onStartTour, manualComplete, onStateChange, }: OnboardingPaneProps): import("react").JSX.Element;

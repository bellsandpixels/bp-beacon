import type { OnboardingAdapter, OnboardingStep } from './onboardingTypes.js';
export interface OnboardingPaneProps {
    adapter: OnboardingAdapter;
    steps: readonly OnboardingStep[];
    title?: string;
    intro?: string;
    onClose: () => void;
    onStartTour?: () => void;
    manualComplete?: boolean;
}
export declare function OnboardingPane({ adapter, steps, title, intro, onClose, onStartTour, manualComplete, }: OnboardingPaneProps): import("react").JSX.Element;

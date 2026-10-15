import type { OnboardingAdapter, TourOutcome, TourStep } from './onboardingTypes.js';
export interface CoachTourProps {
    adapter: OnboardingAdapter;
    tourId: string;
    steps: readonly TourStep[];
    onClose: (outcome: TourOutcome) => void;
    root?: ParentNode;
}
export declare function CoachTour({ adapter, tourId, steps, onClose, root }: CoachTourProps): import("react").JSX.Element | null;

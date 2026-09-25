export interface OnboardingStep {
    id: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}
export type TourOutcome = 'completed' | 'skipped';
export interface OnboardingState {
    completed: string[];
    skippedAt?: string;
    suppressed: boolean;
    tours: Record<string, TourOutcome>;
    lastSeenVersion?: string;
}
export interface OnboardingAdapter {
    load(): Promise<OnboardingState>;
    completeStep(stepId: string): Promise<OnboardingState>;
    skip(): Promise<OnboardingState>;
    setSuppressed(suppressed: boolean): Promise<OnboardingState>;
    finishTour(tourId: string, outcome: TourOutcome): Promise<OnboardingState>;
    markVersionSeen(version: string): Promise<OnboardingState>;
    reset(): Promise<OnboardingState>;
}
export interface OnboardingPolicy {
    resurfaceAfterMs?: number;
}
export interface TourStep {
    target: string;
    title: string;
    body?: string;
}

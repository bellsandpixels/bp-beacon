export interface OnboardingStep {
    id: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        close?: boolean;
    };
}
export type TourOutcome = 'completed' | 'skipped';
export interface OnboardingState {
    completed: string[];
    skippedAt?: string;
    suppressed: boolean;
    tours: Record<string, TourOutcome>;
    lastSeenVersion?: string;
    moments?: Record<string, MomentOutcome>;
}
export interface OnboardingAdapter {
    load(): Promise<OnboardingState>;
    completeStep(stepId: string): Promise<OnboardingState>;
    skip(): Promise<OnboardingState>;
    setSuppressed(suppressed: boolean): Promise<OnboardingState>;
    finishTour(tourId: string, outcome: TourOutcome): Promise<OnboardingState>;
    markVersionSeen(version: string): Promise<OnboardingState>;
    recordMoment?(momentId: string, outcome: MomentOutcome): Promise<OnboardingState>;
    reset(): Promise<OnboardingState>;
    subscribe?(listener: (state: OnboardingState) => void): () => void;
}
export interface OnboardingPolicy {
    resurfaceAfterMs?: number;
}
export interface TourStep {
    target: string;
    title: string;
    body?: string;
}
export type MomentOutcome = 'seen' | 'hidden';
export interface Moment {
    id: string;
    label?: string;
    title: string;
    body: string | readonly string[];
    ok?: string;
    repeat?: boolean;
}
export interface BeaconTour {
    id: string;
    steps: readonly TourStep[];
    autoStart?: boolean;
}

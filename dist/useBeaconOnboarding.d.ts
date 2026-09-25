import { type CSSProperties, type ReactNode } from 'react';
import { type AutoOpenPanel } from './onboardingDecide.js';
import { type VersionedEntry } from './whatsNew.js';
import type { OnboardingAdapter, OnboardingPolicy, OnboardingState, OnboardingStep, TourStep } from './onboardingTypes.js';
export interface BeaconOnboardingConfig {
    product: string;
    userKey?: string;
    version?: string;
    entries: readonly VersionedEntry[];
    steps: readonly OnboardingStep[];
    title?: string;
    intro?: string;
    manualComplete?: boolean;
    tour?: {
        id: string;
        steps: readonly TourStep[];
    };
    policy?: OnboardingPolicy & {
        whatsNewOnUpgrade?: boolean;
    };
    adapter?: OnboardingAdapter;
    enabled?: boolean;
    style?: CSSProperties;
}
export interface BeaconOnboardingFrameProps {
    autoOpen?: AutoOpenPanel;
    newVersions?: string[];
    renderOnboarding?: (ctx: {
        onClose: () => void;
    }) => ReactNode;
}
export interface BeaconOnboarding {
    frame: BeaconOnboardingFrameProps;
    tour: ReactNode;
    state: OnboardingState | null;
    adapter: OnboardingAdapter;
    startTour: () => void;
}
export declare function useBeaconOnboarding(config: BeaconOnboardingConfig): BeaconOnboarding;

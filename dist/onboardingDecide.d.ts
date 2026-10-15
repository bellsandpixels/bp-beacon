import { type VersionedEntry, type WhatsNewResult } from './whatsNew.js';
import type { BeaconTour, OnboardingPolicy, OnboardingState, OnboardingStep } from './onboardingTypes.js';
export type AutoOpenPanel = 'changelog' | 'onboarding';
export declare function decideAutoOpen(news: WhatsNewResult<VersionedEntry> | null, state: OnboardingState, steps: readonly OnboardingStep[], now?: Date, policy?: OnboardingPolicy & {
    whatsNewOnUpgrade?: boolean;
}): AutoOpenPanel | undefined;
export declare function newestParseableVersion(entries: readonly VersionedEntry[]): string | undefined;
export declare function pickAutoStartTour(state: OnboardingState, tours: readonly BeaconTour[], hasAnchor: (target: string) => boolean): BeaconTour | undefined;

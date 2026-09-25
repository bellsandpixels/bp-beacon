import type { OnboardingAdapter, OnboardingPolicy, OnboardingState, OnboardingStep } from './onboardingTypes.js';
export type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface LocalOnboardingStoreConfig {
    product: string;
    userKey?: string;
    storage?: OnboardingStorage;
    now?: () => Date;
}
export declare const DEFAULT_RESURFACE_MS: number;
export declare function emptyOnboardingState(): OnboardingState;
export declare function onboardingStorageKey(product: string, userKey?: string): string;
export declare function parseOnboardingState(raw: string | null): OnboardingState;
export declare function createLocalOnboardingStore(config: LocalOnboardingStoreConfig): OnboardingAdapter;
export declare function isChecklistDone(state: OnboardingState, steps: readonly OnboardingStep[]): boolean;
export declare function shouldAutoOpenOnboarding(state: OnboardingState, steps: readonly OnboardingStep[], now?: Date, policy?: OnboardingPolicy): boolean;
export declare function shouldAutoStartTour(state: OnboardingState, tourId: string): boolean;

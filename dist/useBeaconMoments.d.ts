import { type CSSProperties, type ReactNode } from 'react';
import type { Moment, OnboardingAdapter } from './onboardingTypes.js';
export interface BeaconMomentsConfig {
    adapter: OnboardingAdapter;
    moments: readonly Moment[];
    enabled?: boolean;
    style?: CSSProperties;
}
export interface BeaconMoments {
    node: ReactNode;
    show: (momentId: string) => void;
}
export declare function useBeaconMoments({ adapter, moments, enabled, style }: BeaconMomentsConfig): BeaconMoments;

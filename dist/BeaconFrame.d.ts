import { type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type { VersionedEntry } from './whatsNew.js';
import type { OnboardingAdapter, OnboardingPolicy, OnboardingStep, TourStep } from './onboardingTypes.js';
export interface BeaconFrameProps {
    appFrame: ComponentType<any>;
    parseChangelog: (markdown: string) => VersionedEntry[];
    product: string;
    whatsNewKey?: 'version' | 'date';
    steps?: readonly OnboardingStep[];
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
    userId?: string;
    userKey?: string;
    appName?: string;
    version?: string;
    changelogMarkdown?: string;
    help?: unknown;
    slots?: Record<string, unknown>;
}
export declare function BeaconFrame({ appFrame: AppFrame, parseChangelog, product, whatsNewKey, steps, title, intro, manualComplete, tour, policy, adapter, enabled, style, userId, userKey, appName, version, changelogMarkdown, help, slots, }: BeaconFrameProps): ReactNode;

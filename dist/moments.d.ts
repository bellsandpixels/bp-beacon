import type { Moment, MomentOutcome, OnboardingState } from './onboardingTypes.js';
export declare const MOMENT_EVENT = "bp:beacon:moment";
export declare function announceMoment(momentId: string): void;
export declare function shouldShowMoment(state: OnboardingState, moment: Pick<Moment, 'id' | 'repeat'>, shownThisVisit?: ReadonlySet<string>): boolean;
export declare function momentOutcome(moment: Pick<Moment, 'repeat'>, dontShowAgain: boolean): MomentOutcome | undefined;
export declare function withMomentOutcome(state: OnboardingState, momentId: string, outcome: MomentOutcome): OnboardingState;
export declare function momentParagraphs(body: Moment['body']): string[];
export declare function findMoment(moments: readonly Moment[], momentId: unknown): Moment | undefined;

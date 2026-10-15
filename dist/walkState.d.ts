import type { WalkState } from './walkTypes.js';
/** Mark a surface walked (`on`) or not walked. */
export declare function withWalked(s: WalkState, surfaceKey: string, on: boolean): WalkState;
/** Set (or add) a flagged check's note. An empty note is still a flag: in progress, not yet counted. */
export declare function withDefect(s: WalkState, checkRef: number, note: string): WalkState;
/** Clear these flagged checks. */
export declare function withoutDefects(s: WalkState, checkRefs: readonly number[]): WalkState;
/** Put flags back exactly as they were (the rollback of a clear). */
export declare function withDefects(s: WalkState, entries: ReadonlyArray<readonly [number, string]>): WalkState;
/** Whether a check is flagged (an own key, so a note of '' still counts as flagged). */
export declare function isFlagged(s: WalkState, checkRef: number): boolean;
/** The message a failed start shows. Never empty: a blank error would read as no error at all. */
export declare function startFailureMessage(e: unknown): string;

import type { ValidationCatalogue, WalkState, WalkSurface, WalkCheck } from './walkTypes.js';
export type VerdictLabel = 'PASS' | 'FAIL' | 'BLOCKED' | 'INCOMPLETE' | 'NOT REVIEWED';
export interface Verdict {
    label: VerdictLabel;
    line: string;
    walked: number;
    total: number;
    defects: number;
    blockers: number;
}
export declare function surfacesOf(catalogue: ValidationCatalogue): WalkSurface[];
export declare function checkByNumber(catalogue: ValidationCatalogue, n: number): WalkCheck | undefined;
export declare function deriveVerdict(catalogue: ValidationCatalogue, state: WalkState): Verdict;

import type { WalkAssignmentSummary } from './walkTypes.js';
export interface WalkBuildGroup {
    build: string;
    env?: string;
    assignments: WalkAssignmentSummary[];
}
export interface WalkTodo {
    inProgress: WalkAssignmentSummary[];
    groups: WalkBuildGroup[];
}
/** Compare two Major.Minor.Patch.Build strings numerically, newest first. Non-numeric parts sort last. */
export declare function compareBuildsDesc(a: string, b: string): number;
/** Split the assigned walks into the ones under way and the rest grouped by build (newest first). */
export declare function groupAssignments(assigned: WalkAssignmentSummary[]): WalkTodo;

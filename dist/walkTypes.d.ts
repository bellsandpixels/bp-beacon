import type { FeedbackStatus } from './types.js';
export type CheckSeverity = 'blocker' | 'debt';
export interface WalkCheck {
    n: number;
    text: string;
    severity?: CheckSeverity;
}
export interface WalkSurface {
    key: string;
    title: string;
    route?: string;
    checks: WalkCheck[];
}
export interface WalkArea {
    title: string;
    note?: string;
    surfaces: WalkSurface[];
}
export interface ValidationCatalogue {
    catalogueId: string;
    target: string;
    themes?: string[];
    areas: WalkArea[];
}
export interface WalkState {
    walked: Record<string, boolean>;
    defects: Record<number, string>;
}
export interface WalkSummary {
    walkId: string;
    build: string;
    env: string;
    submittedOn?: string;
    coverage: {
        walked: number;
        total: number;
    };
    flagged: number;
}
export interface WalkIssue {
    id: string;
    reference?: string;
    checkRef: number;
    surfaceKey?: string;
    title: string;
    status: FeedbackStatus;
    resolvedBuild?: string;
    build: string;
}
export interface WalkIdentity {
    authenticated: boolean;
    name?: string;
}
export interface WalkAvailability {
    offered: boolean;
    build: string;
    env: string;
    catalogueId: string;
}
export interface WalkAdapter {
    authenticate: () => Promise<WalkIdentity>;
    identity: () => Promise<WalkIdentity>;
    available: () => Promise<WalkAvailability | null>;
    start: () => Promise<WalkState>;
    markWalked: (surfaceKey: string, walked: boolean) => Promise<void>;
    flag: (input: {
        checkRef: number;
        note: string;
    }) => Promise<{
        id: string;
        reference?: string;
    }>;
    clearFlag: (checkRef: number) => Promise<void>;
    submit: () => Promise<WalkSummary>;
    listMine: () => Promise<WalkSummary[]>;
    listMyIssues: () => Promise<WalkIssue[]>;
}

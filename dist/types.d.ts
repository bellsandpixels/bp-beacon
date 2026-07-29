export type FeedbackKind = 'bug' | 'idea';
export type FeedbackStatus = 'submitted' | 'triaging' | 'accepted' | 'routed' | 'declined' | 'duplicate' | 'parked' | 'closed';
export interface FeedbackReport {
    id: string;
    reference?: string;
    title: string;
    kind: FeedbackKind;
    status: FeedbackStatus;
    createdAt?: string;
}
export interface BeaconContext {
    appName: string;
    appVersion: string;
    env: string;
    platform: 'web';
    osMajor: string;
    route: string;
    locale: string;
}
export interface BeaconEnvelope {
    product: string;
    kind: FeedbackKind;
    title: string;
    details: string;
    consent: boolean;
    clientReportId?: string;
    hp: string;
    context?: BeaconContext;
}
export interface FeedbackAdapter {
    submit: (input: {
        kind: FeedbackKind;
        title: string;
        details: string;
        consent: boolean;
    }) => Promise<{
        id: string;
        reference?: string;
    }>;
    list?: () => Promise<FeedbackReport[]>;
    confirm?: (id: string) => Promise<void>;
    reopen?: (id: string) => Promise<void>;
}

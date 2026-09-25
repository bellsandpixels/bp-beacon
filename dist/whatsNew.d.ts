export interface VersionedEntry {
    version: string;
}
export interface WhatsNewResult<T extends VersionedEntry> {
    entries: T[];
    shouldOpen: boolean;
    firstVisit: boolean;
}
export declare function parseVersion(version: string): number[] | null;
export declare function compareVersions(a: string, b: string): number | null;
export declare function whatsNewSinceLastVisit<T extends VersionedEntry>(entries: readonly T[], currentVersion: string, lastSeenVersion: string | undefined): WhatsNewResult<T>;

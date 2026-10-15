export interface VersionedEntry {
    version: string;
    date?: string;
}
export interface WhatsNewResult<T extends VersionedEntry> {
    entries: T[];
    shouldOpen: boolean;
    firstVisit: boolean;
}
export declare function parseVersion(version: string): number[] | null;
export declare function compareVersions(a: string, b: string): number | null;
export declare function whatsNewSinceLastVisit<T extends VersionedEntry>(entries: readonly T[], currentVersion: string, lastSeenVersion: string | undefined): WhatsNewResult<T>;
export declare function newestEntryDate(entries: readonly VersionedEntry[]): string | undefined;
export declare function whatsNewSinceLastVisitByDate<T extends VersionedEntry>(entries: readonly T[], currentDate: string, lastSeenDate: string | undefined): WhatsNewResult<T>;

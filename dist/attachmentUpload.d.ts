import type { BeaconAttachmentRef } from './types.js';
export interface UploadResult {
    clientReportId: string;
    attachments: BeaconAttachmentRef[];
}
export declare function newClientReportId(): string | undefined;
export declare function uploadViaTickets(doFetch: typeof fetch, ticketEndpoint: string, files: File[]): Promise<UploadResult>;

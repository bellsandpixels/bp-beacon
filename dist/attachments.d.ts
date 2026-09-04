export declare const ATTACHMENT_IMAGE_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
export declare const ATTACHMENT_ACCEPT: string;
export declare const MAX_ATTACHMENT_BYTES: number;
export declare const MAX_ATTACHMENTS = 3;
export declare function validateAttachmentFile(file: {
    type: string;
    size: number;
}): string | null;

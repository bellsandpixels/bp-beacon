// Client-side attachment helpers for the two-phase upload (cp-beacon-attachments). The FeedbackPane uses
// these to validate what the reporter picked before uploading; the SERVER re-verifies every file (existence,
// actual size, magic-number sniff), so this is only the friendly up-front gate. Images only for v1.

export const ATTACHMENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
// The <input accept="..."> value.
export const ATTACHMENT_ACCEPT = ATTACHMENT_IMAGE_TYPES.join(',')
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_ATTACHMENTS = 3

// Validate one selected file against the v1 image allow-list + size cap. Returns a reporter-facing error
// string, or null when the file is acceptable.
export function validateAttachmentFile(file: { type: string; size: number }): string | null {
  if (!(ATTACHMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PNG, JPEG, or WebP images can be attached.'
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'Images must be 10 MB or smaller.'
  }
  return null
}

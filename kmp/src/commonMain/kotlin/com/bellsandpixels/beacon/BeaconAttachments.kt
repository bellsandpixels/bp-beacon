package com.bellsandpixels.beacon

// Client-side attachment helpers for the two-phase upload (cp-beacon-attachments). The native
// FeedbackPane uses these to validate what the reporter picked before uploading; the SERVER re-verifies
// every file (existence, actual size, magic-number sniff), so this is only the friendly up-front gate.
// Images only for v1. Keep in lockstep with the web SDK's attachments.ts (same allow-list, cap, size).
object BeaconAttachments {
    val IMAGE_TYPES: List<String> = listOf("image/png", "image/jpeg", "image/webp")
    const val MAX_BYTES: Long = 10L * 1024 * 1024 // 10 MB
    const val MAX_ATTACHMENTS: Int = 3

    // Validate one selected file against the v1 image allow-list + size cap. Returns a reporter-facing
    // error string, or null when the file is acceptable.
    fun validate(contentType: String, bytes: Long): String? {
        if (contentType !in IMAGE_TYPES) {
            return "Only PNG, JPEG, or WebP images can be attached."
        }
        if (bytes > MAX_BYTES) {
            return "Images must be 10 MB or smaller."
        }
        return null
    }

    // Convenience over a picked attachment.
    fun validate(attachment: BeaconAttachment): String? =
        validate(attachment.contentType, attachment.bytes.size.toLong())
}

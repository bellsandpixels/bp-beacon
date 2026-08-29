package com.bellsandpixels.beacon

import kotlinx.serialization.Serializable

// The consented, allow-list-ONLY diagnostics [D3]. This is the exact client-safe shape the
// client-portal anonymous intake endpoint accepts, and the same one the web Beacon sends. There is NO
// field here for a stable device/user id, an IP, a full user-agent, an account, or any card/study/FSRS
// data - by construction. Adding one would break the 4a amendment (a feedback+diagnostics-only channel,
// never an audience model). Keep it in lockstep with the web client (fudemoji web diagnostics.ts).
@Serializable
data class BeaconContext(
    val appName: String,
    val appVersion: String,
    val env: String,        // "production" | "alpha" | "dev"
    val platform: String,   // app surface: "android" | "ios"
    val device: String,     // coarse form factor ONLY: "phone" | "tablet" ("" dropped downstream). Never a model.
    val os: String,         // coarse OS family ONLY: "android" | "ios" (the bucket behind osMajor). Never a build.
    val osMajor: String,    // OS major only, e.g. "Android 15" / "iOS 18"
    val locale: String,     // e.g. "en-US"
    val route: String? = null, // optional in-app screen name; never a study id
)

// App-provided identity. The app knows these (its own version + ring); :beacon never guesses them and
// never reaches into the study engine to derive them.
data class BeaconAppMeta(
    val appName: String,
    val appVersion: String,
    val env: String,
    val route: String? = null,
)

// The kinds an anonymous reporter may file (matches the endpoint: bug | idea).
enum class BeaconKind(val wire: String) {
    Bug("bug"),
    Idea("idea"),
}

// The submission envelope POSTed to /api/beacon-signal. `hp` is the honeypot (always empty from a real
// client). `context` rides ONLY on explicit consent. `product` is stamped by the app (here, fudemoji).
@Serializable
internal data class BeaconEnvelope(
    val product: String,
    val kind: String,
    val title: String,
    val details: String,
    val consent: Boolean,
    val clientReportId: String,
    val hp: String = "",
    val context: BeaconContext? = null,
)

// The outcome surfaced to the UI. Submit-only: there is no reporter loop for anonymous rows.
sealed interface BeaconResult {
    data class Ok(val intakeNumber: String?) : BeaconResult
    data class Failed(val status: Int?, val message: String) : BeaconResult
}

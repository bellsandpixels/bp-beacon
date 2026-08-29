package com.bellsandpixels.beacon

// Platform-captured, allow-list ONLY: the coarse OS family + major, the platform, the coarse form
// factor, and the device locale. Read from the OS (Android Build / iOS UIDevice + the platform locale)
// with NO Context or study-engine coupling. The app-identity fields (appName/appVersion/env/route) come
// from BeaconAppMeta, not from here.
data class PlatformContext(
    val platform: String, // app surface: "android" | "ios"
    val device: String,   // coarse form factor ONLY: "phone" | "tablet" ("" when undeterminable). Never a model.
    val os: String,       // coarse OS family ONLY: "android" | "ios" (the bucket behind osMajor). Never a build.
    val osMajor: String,  // e.g. "Android 15" / "iOS 18"
    val locale: String,   // e.g. "en-US"
)

// Implemented per platform: androidMain reads android.os.Build + the JVM locale; iosMain reads
// UIDevice + NSLocale. Neither reads an account, a stable id, or any card/study data.
expect fun capturePlatformContext(): PlatformContext

// The Ktor HTTP engine for the platform, supplied EXPLICITLY rather than via Ktor's ServiceLoader
// engine auto-discovery. On Android that auto-discovery (a no-arg `HttpClient {}`) silently fails to
// resolve the OkHttp engine and every submission was caught as a generic "could not send" (dogfood
// 2026-08-25); passing the engine directly is the robust, recommended KMP pattern. androidMain -> OkHttp,
// iosMain -> Darwin. Tests inject a MockEngine through BeaconClient's `engine` param and never call this.
expect fun beaconHttpEngine(): io.ktor.client.engine.HttpClientEngine

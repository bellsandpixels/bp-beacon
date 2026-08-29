package com.bellsandpixels.beacon

import android.content.res.Resources
import android.os.Build
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import java.util.Locale

// Android: OS family + major from Build, coarse form factor from the system configuration, locale from
// the JVM default. All Context-free (Resources.getSystem() is static). No account, no id, no study data.
actual fun capturePlatformContext(): PlatformContext = PlatformContext(
    platform = "android",
    device = coarseFormFactor(),
    os = "android",
    osMajor = "Android ${Build.VERSION.RELEASE}",
    locale = Locale.getDefault().toLanguageTag(),
)

// Coarse phone/tablet ONLY, from the system's smallest-width bucket (the standard >=600dp tablet line).
// Context-free via Resources.getSystem(); "" when the metric is unavailable (dropped downstream). Never a
// model, never dimensions - just the one bucket the triager needs to reproduce a layout bug.
private fun coarseFormFactor(): String {
    val sw = Resources.getSystem().configuration.smallestScreenWidthDp
    return when {
        sw <= 0 -> ""
        sw >= 600 -> "tablet"
        else -> "phone"
    }
}

// Explicit OkHttp engine (see the expect in commonMain): auto-discovery was failing on-device.
actual fun beaconHttpEngine(): HttpClientEngine = OkHttp.create()

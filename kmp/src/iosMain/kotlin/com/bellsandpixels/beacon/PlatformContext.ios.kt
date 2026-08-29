package com.bellsandpixels.beacon

import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.darwin.Darwin
import platform.Foundation.NSLocale
import platform.Foundation.currentLocale
import platform.Foundation.localeIdentifier
import platform.UIKit.UIDevice
import platform.UIKit.UIUserInterfaceIdiomPad
import platform.UIKit.UIUserInterfaceIdiomPhone

// iOS: OS family + major from UIDevice, coarse form factor from the interface idiom, locale from
// NSLocale. No account, no id, no study data. AUTHORED on Windows; compiled by Kotlin/Native on the Mac
// host (fdm-beacon-native-submit, iOS closes at built here and reaches proven on the iPad).
actual fun capturePlatformContext(): PlatformContext {
    val systemVersion = UIDevice.currentDevice.systemVersion // e.g. "18.1"
    val major = systemVersion.substringBefore('.')
    // Coarse phone/tablet ONLY from the interface idiom; "" for anything else (dropped downstream).
    val device = when (UIDevice.currentDevice.userInterfaceIdiom) {
        UIUserInterfaceIdiomPhone -> "phone"
        UIUserInterfaceIdiomPad -> "tablet"
        else -> ""
    }
    return PlatformContext(
        platform = "ios",
        device = device,
        os = "ios",
        osMajor = "iOS $major",
        locale = NSLocale.currentLocale.localeIdentifier.replace('_', '-'),
    )
}

// Explicit Darwin engine (see the expect in commonMain): the native app supplies its engine directly.
actual fun beaconHttpEngine(): HttpClientEngine = Darwin.create()

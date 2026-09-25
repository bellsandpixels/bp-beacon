package com.bellsandpixels.beacon.onboarding

import platform.Foundation.NSDate
import platform.Foundation.NSUserDefaults
import platform.Foundation.timeIntervalSince1970

// AUTHORED here; compiled by Kotlin/Native on the Mac host (this repo has no macOS CI, the proof is the
// fudemoji gradle link on the Mac).
actual fun currentTimeMillis(): Long = (NSDate().timeIntervalSince1970 * 1000).toLong()

// An NSUserDefaults-backed OnboardingStorage the app passes to OnboardingStore. Synchronous; no account,
// no study data.
class IosOnboardingStorage : OnboardingStorage {
    private val defaults = NSUserDefaults.standardUserDefaults
    override fun getItem(key: String): String? = defaults.stringForKey(key)
    override fun setItem(key: String, value: String) = defaults.setObject(value, key)
    override fun removeItem(key: String) = defaults.removeObjectForKey(key)
}

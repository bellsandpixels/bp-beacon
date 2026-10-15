package com.bellsandpixels.beacon.onboarding

import android.content.Context

actual fun currentTimeMillis(): Long = System.currentTimeMillis()

// A SharedPreferences-backed OnboardingStorage the app builds from its Context and passes to
// OnboardingStore. SharedPreferences is synchronous to read and apply(); no account, no study data.
class AndroidOnboardingStorage(context: Context) : OnboardingStorage {
    private val prefs = context.getSharedPreferences("bp_beacon_onboarding", Context.MODE_PRIVATE)
    override fun getItem(key: String): String? = prefs.getString(key, null)
    override fun setItem(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
    override fun removeItem(key: String) {
        prefs.edit().remove(key).apply()
    }
}

package com.bellsandpixels.beacon.onboarding

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// The KMP onboarding store: a faithful port of the web store (bp-beacon/src/onboardingStore.ts,
// cp-beacon-onboarding-core), so the native Beacon (fudemoji Android + iOS) speaks the same first-run
// semantics as the web surface. State + adapter + the pure policy that decides what auto-opens.
//
// Divergence the port spec (bp-knowledge kb/kmp-onboarding-store-port.md) allows: this store has its OWN
// storage (SharedPreferences / NSUserDefaults) and never reads the web's localStorage, so the serialized
// shape need not match the web byte for byte. skippedAt is epoch millis (Long?), not an ISO string, so no
// date parsing or kotlinx-datetime dependency is needed. The store is synchronous (both platform stores
// are); the app can wrap it if it ever needs async.

// id -> outcome, kept as the same wire strings the web writes so a tour record reads the same either side.
enum class TourOutcome(val wire: String) { COMPLETED("completed"), SKIPPED("skipped") }

@Serializable
data class OnboardingState(
    val completed: List<String> = emptyList(),
    val skippedAtMs: Long? = null,               // epoch millis of the last Skip (web stores an ISO string)
    val suppressed: Boolean = false,             // "don't show again"
    val tours: Map<String, String> = emptyMap(), // id -> "completed" | "skipped" (wire strings)
    val lastSeenVersion: String? = null,
)

// The resurface window: after a Skip, the welcome stays quiet this long, then may auto-open again.
const val DEFAULT_RESURFACE_MS: Long = 7L * 24 * 60 * 60 * 1000

// One record per product + user, keeping each product's first-run separate on a shared store; userKey is a
// stable, non-identifying key for the signed-in user (omitted -> "anon", per device).
fun onboardingStorageKey(product: String, userKey: String?): String =
    "bp:beacon:onboarding:$product:${userKey ?: "anon"}"

private val json = Json { ignoreUnknownKeys = true }

// Parse defensively: a hand-edited or older record must never break the first-run, so anything
// unrecognized falls back to the empty state rather than throwing.
fun parseOnboardingState(raw: String?): OnboardingState =
    if (raw.isNullOrBlank()) OnboardingState()
    else runCatching { json.decodeFromString<OnboardingState>(raw) }.getOrDefault(OnboardingState())

// The storage seam, mirroring the web OnboardingStorage (getItem/setItem/removeItem). The app provides the
// platform implementation (androidMain SharedPreferences, iosMain NSUserDefaults); commonTest injects an
// in-memory map. Reads/writes may fail (blocked storage); the store guards them and keeps a memory copy.
interface OnboardingStorage {
    fun getItem(key: String): String?
    fun setItem(key: String, value: String)
    fun removeItem(key: String)
}

class OnboardingStore(
    product: String,
    userKey: String? = null,
    private val storage: OnboardingStorage,
    private val nowMs: () -> Long = ::currentTimeMillis,
) {
    private val key = onboardingStorageKey(product, userKey)
    private var memory: OnboardingState? = null

    fun load(): OnboardingState = memory ?: parseOnboardingState(storage.getItem(key)).also { memory = it }

    private fun update(fn: (OnboardingState) -> OnboardingState): OnboardingState {
        val next = fn(load())
        memory = next
        // Quota or blocked storage: keep the in-memory copy so this session still behaves.
        runCatching { storage.setItem(key, json.encodeToString(next)) }
        return next
    }

    fun completeStep(id: String) =
        update { if (id in it.completed) it else it.copy(completed = it.completed + id) }

    fun skip() = update { it.copy(skippedAtMs = nowMs()) }

    fun setSuppressed(v: Boolean) = update { it.copy(suppressed = v) }

    fun finishTour(id: String, outcome: TourOutcome) =
        update { it.copy(tours = it.tours + (id to outcome.wire)) }

    fun markVersionSeen(version: String) = update { it.copy(lastSeenVersion = version) }

    fun reset(): OnboardingState {
        memory = OnboardingState()
        runCatching { storage.removeItem(key) }
        return memory!!
    }
}

// ---- policy: what opens by itself ----------------------------------------------------------------

fun isChecklistDone(state: OnboardingState, stepIds: List<String>): Boolean =
    stepIds.all { it in state.completed }

// Auto-open the welcome pane only when the user has not opted out, the checklist is unfinished, and any
// Skip is older than the resurface window. Opening it by hand is always allowed; this governs only the
// automatic first-run.
fun shouldAutoOpenOnboarding(
    state: OnboardingState,
    stepIds: List<String>,
    nowMs: Long,
    resurfaceMs: Long = DEFAULT_RESURFACE_MS,
): Boolean {
    if (state.suppressed) return false
    if (stepIds.isNotEmpty() && isChecklistDone(state, stepIds)) return false
    val skipped = state.skippedAtMs
    if (skipped != null && nowMs - skipped < resurfaceMs) return false
    return true
}

// Tours are one-shot: once finished or skipped they never auto-start again, and "don't show again" stops
// every tour.
fun shouldAutoStartTour(state: OnboardingState, tourId: String): Boolean =
    !state.suppressed && state.tours[tourId] == null

// The clock seam (an expect, like capturePlatformContext), so tests inject a fixed time and no
// kotlinx-datetime dependency is pulled in. androidMain -> System.currentTimeMillis, iosMain -> NSDate.
expect fun currentTimeMillis(): Long

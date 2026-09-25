package com.bellsandpixels.beacon.onboarding

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// In-memory OnboardingStorage, standing in for SharedPreferences / NSUserDefaults in commonTest.
private class MemoryStorage : OnboardingStorage {
    val map = mutableMapOf<String, String>()
    override fun getItem(key: String): String? = map[key]
    override fun setItem(key: String, value: String) { map[key] = value }
    override fun removeItem(key: String) { map.remove(key) }
}

class OnboardingStoreTest {

    private fun store(
        storage: MemoryStorage = MemoryStorage(),
        product: String = "fudemoji",
        userKey: String? = null,
        now: Long = 1_000_000L,
    ) = OnboardingStore(product, userKey, storage, nowMs = { now })

    // ---- storage key ----------------------------------------------------------------------------

    @Test
    fun storage_key_is_namespaced_by_product_and_user() {
        assertEquals("bp:beacon:onboarding:fudemoji:anon", onboardingStorageKey("fudemoji", null))
        assertEquals("bp:beacon:onboarding:fudemoji:u42", onboardingStorageKey("fudemoji", "u42"))
    }

    // ---- completeStep ---------------------------------------------------------------------------

    @Test
    fun completeStep_is_idempotent_and_persists() {
        val storage = MemoryStorage()
        val s = store(storage)
        s.completeStep("write-first-card")
        s.completeStep("write-first-card") // idempotent: no duplicate
        s.completeStep("import-deck")
        assertEquals(listOf("write-first-card", "import-deck"), s.load().completed)

        // Persisted: a fresh store over the same storage reads the same completed set.
        val reloaded = store(storage).load()
        assertEquals(listOf("write-first-card", "import-deck"), reloaded.completed)
    }

    // ---- skip + resurface window ----------------------------------------------------------------

    @Test
    fun skip_stamps_time_and_gates_auto_open_within_the_window() {
        val storage = MemoryStorage()
        val skipAt = 1_000_000L
        val s = store(storage, now = skipAt)
        s.skip()
        assertEquals(skipAt, s.load().skippedAtMs)

        val steps = listOf("a", "b")
        // Within the window: quiet.
        assertFalse(shouldAutoOpenOnboarding(s.load(), steps, nowMs = skipAt + DEFAULT_RESURFACE_MS - 1))
        // At/after the window: may auto-open again.
        assertTrue(shouldAutoOpenOnboarding(s.load(), steps, nowMs = skipAt + DEFAULT_RESURFACE_MS))
        assertTrue(shouldAutoOpenOnboarding(s.load(), steps, nowMs = skipAt + DEFAULT_RESURFACE_MS + 1))
    }

    @Test
    fun fresh_state_auto_opens() {
        assertTrue(shouldAutoOpenOnboarding(OnboardingState(), listOf("a"), nowMs = 5_000L))
    }

    // ---- checklist done -------------------------------------------------------------------------

    @Test
    fun finished_checklist_suppresses_auto_open() {
        val steps = listOf("a", "b")
        val partial = OnboardingState(completed = listOf("a"))
        assertFalse(isChecklistDone(partial, steps))
        assertTrue(shouldAutoOpenOnboarding(partial, steps, nowMs = 5_000L))

        val done = OnboardingState(completed = listOf("a", "b"))
        assertTrue(isChecklistDone(done, steps))
        assertFalse(shouldAutoOpenOnboarding(done, steps, nowMs = 5_000L))

        // An empty step list is never "done" and does not gate auto-open (What's-new-only case).
        assertTrue(shouldAutoOpenOnboarding(OnboardingState(), emptyList(), nowMs = 5_000L))
    }

    // ---- suppressed -----------------------------------------------------------------------------

    @Test
    fun suppressed_stops_auto_open_and_every_tour() {
        val storage = MemoryStorage()
        val s = store(storage)
        s.setSuppressed(true)
        assertTrue(s.load().suppressed)
        assertFalse(shouldAutoOpenOnboarding(s.load(), listOf("a"), nowMs = 10_000_000L))
        assertFalse(shouldAutoStartTour(s.load(), "any-tour"))

        s.setSuppressed(false)
        assertTrue(shouldAutoStartTour(s.load(), "any-tour"))
    }

    // ---- tours ----------------------------------------------------------------------------------

    @Test
    fun finishTour_makes_the_tour_not_auto_start_and_records_the_outcome() {
        val storage = MemoryStorage()
        val s = store(storage)
        assertTrue(shouldAutoStartTour(s.load(), "rail-tour"))
        s.finishTour("rail-tour", TourOutcome.COMPLETED)
        assertFalse(shouldAutoStartTour(s.load(), "rail-tour"))
        assertEquals("completed", s.load().tours["rail-tour"])
        // A different tour is still eligible.
        assertTrue(shouldAutoStartTour(s.load(), "other-tour"))

        s.finishTour("other-tour", TourOutcome.SKIPPED)
        assertEquals("skipped", s.load().tours["other-tour"])
        assertFalse(shouldAutoStartTour(s.load(), "other-tour"))
    }

    // ---- markVersionSeen ------------------------------------------------------------------------

    @Test
    fun markVersionSeen_round_trips() {
        val storage = MemoryStorage()
        val s = store(storage)
        assertNull(s.load().lastSeenVersion)
        s.markVersionSeen("1.2.0")
        assertEquals("1.2.0", s.load().lastSeenVersion)
        assertEquals("1.2.0", store(storage).load().lastSeenVersion) // persisted
    }

    // ---- reset ----------------------------------------------------------------------------------

    @Test
    fun reset_clears_state_and_storage() {
        val storage = MemoryStorage()
        val s = store(storage)
        s.completeStep("a")
        s.setSuppressed(true)
        s.markVersionSeen("1.0.0")
        val cleared = s.reset()
        assertEquals(OnboardingState(), cleared)
        assertNull(storage.getItem(onboardingStorageKey("fudemoji", null)))
        // A fresh store over the same storage also sees the empty state.
        assertEquals(OnboardingState(), store(storage).load())
    }

    // ---- defensive parse ------------------------------------------------------------------------

    @Test
    fun parse_falls_back_to_empty_for_null_blank_and_garbage() {
        assertEquals(OnboardingState(), parseOnboardingState(null))
        assertEquals(OnboardingState(), parseOnboardingState(""))
        assertEquals(OnboardingState(), parseOnboardingState("   "))
        assertEquals(OnboardingState(), parseOnboardingState("not json at all {"))
        assertEquals(OnboardingState(), parseOnboardingState("[1,2,3]"))
    }

    @Test
    fun parse_tolerates_partial_and_unknown_fields() {
        // Only some fields present, plus an unknown key: known fields load, unknown is ignored, the rest
        // default. ignoreUnknownKeys keeps a forward/older record from throwing.
        val raw = """{"completed":["a"],"unknownFuture":true}"""
        val parsed = parseOnboardingState(raw)
        assertEquals(listOf("a"), parsed.completed)
        assertFalse(parsed.suppressed)
        assertNull(parsed.skippedAtMs)
        assertNull(parsed.lastSeenVersion)
        assertEquals(emptyMap(), parsed.tours)
    }

    @Test
    fun a_written_record_round_trips_through_parse() {
        val storage = MemoryStorage()
        val s = store(storage, now = 42L)
        s.completeStep("a")
        s.skip()
        s.finishTour("t", TourOutcome.COMPLETED)
        s.markVersionSeen("2.0.0")
        val onDisk = storage.getItem(onboardingStorageKey("fudemoji", null))
        val parsed = parseOnboardingState(onDisk)
        assertEquals(listOf("a"), parsed.completed)
        assertEquals(42L, parsed.skippedAtMs)
        assertEquals("completed", parsed.tours["t"])
        assertEquals("2.0.0", parsed.lastSeenVersion)
    }
}

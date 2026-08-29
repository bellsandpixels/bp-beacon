package com.bellsandpixels.beacon

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// The headless wire-contract suite. Lives in commonTest so EVERY target (the Android unit-test JVM host
// here on Windows, and the iOS test target on the Mac) verifies the exact bytes BeaconClient puts on the
// wire. No emulator, no device, no real network: a MockEngine captures the request body and we assert the
// envelope shape. This is the proof the 4a amendment holds by construction - the client can only emit a
// title, details, an optional consented allow-list context, and an idempotency id.
class BeaconClientTest {
    private val fixedCtx = { PlatformContext(platform = "android", device = "phone", os = "android", osMajor = "Android 15", locale = "en-US") }
    private val appMeta = BeaconAppMeta(appName = "Fudemoji", appVersion = "0.1.27", env = "alpha", route = "/review")

    private fun client(
        capture: (String) -> Unit,
        status: HttpStatusCode = HttpStatusCode.Accepted,
        body: String = """{"ok":true,"intakeNumber":"INT-42"}""",
    ): BeaconClient {
        val engine = MockEngine { request ->
            capture((request.body as? TextContent)?.text ?: "")
            respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "application/json"))
        }
        return BeaconClient(product = "fudemoji", platformContext = fixedCtx, engine = engine)
    }

    @Test
    fun consentOff_sendsContentOnly_noContext() = runTest {
        var sent = ""
        val result = client({ sent = it }).submit(
            kind = BeaconKind.Bug, title = "strokes lag", details = "on save", consent = false, appMeta = appMeta,
        )
        assertTrue(result is BeaconResult.Ok)
        assertTrue(sent.isNotEmpty(), "request body captured")
        assertFalse(sent.contains("\"context\""), "no auto-context without consent")
        assertTrue(sent.contains("\"product\":\"fudemoji\""), "product stamped")
        assertTrue(sent.contains("\"kind\":\"bug\""))
        assertTrue(sent.contains("\"consent\":false"))
    }

    @Test
    fun consentOn_sendsAllowListOnly_noDenyListOrStudyData() = runTest {
        var sent = ""
        val result = client({ sent = it }).submit(
            kind = BeaconKind.Idea, title = "dark mode", details = "", consent = true, appMeta = appMeta,
        )
        assertTrue(result is BeaconResult.Ok)
        assertEquals("INT-42", (result as BeaconResult.Ok).intakeNumber)
        assertTrue(sent.contains("\"context\""), "consent attaches context")
        assertTrue(sent.contains("\"platform\":\"android\""))
        assertTrue(sent.contains("\"device\":\"phone\""), "coarse form factor rides on the allow-list")
        assertTrue(sent.contains("\"os\":\"android\""), "coarse OS family rides on the allow-list")
        assertTrue(sent.contains("\"osMajor\":\"Android 15\""))
        assertTrue(sent.contains("\"appVersion\":\"0.1.27\""))
        assertTrue(sent.contains("\"env\":\"alpha\""))
        assertTrue(sent.contains("\"locale\":\"en-US\""))
        // 4a: no study/account/stable-id/UA/IP field can be present - the envelope has no slot for one.
        val lower = sent.lowercase()
        for (banned in listOf("account", "\"deck", "\"card", "fsrs", "deviceid", "useragent", "\"ip\"", "session")) {
            assertFalse(lower.contains(banned), "deny-list token '$banned' must never be sent")
        }
    }

    // fdm-ios-beacon-diagnostics-parity (gap 12): a submit that OMITS clientReportId - the Android call
    // path (FeedbackPane.kt does not pass one) - must still put a NON-EMPTY idempotency id on the wire,
    // supplied by the client default. This is the contract that keeps the two platforms consistent (iOS
    // passes its own explicit id because Kotlin defaults do not cross the KMP->Swift boundary; Android
    // relies on this default), so the default must never silently regress to an absent/empty key.
    @Test
    fun omittedClientReportId_stillEmitsANonEmptyIdempotencyKey() = runTest {
        var sent = ""
        val result = client({ sent = it }).submit(
            kind = BeaconKind.Bug, title = "no explicit id", details = "", consent = false, appMeta = appMeta,
        )
        assertTrue(result is BeaconResult.Ok)
        val match = Regex("\"clientReportId\":\"([^\"]*)\"").find(sent)
        assertTrue(match != null, "the envelope carries a clientReportId even when the caller omits it")
        assertTrue(match!!.groupValues[1].isNotEmpty(), "the default-supplied idempotency key is non-empty")
    }

    @Test
    fun serverError_mapsToFailed() = runTest {
        val result = client(
            capture = {}, status = HttpStatusCode.BadRequest,
            body = """{"error":{"message":"kind must be 'bug' or 'idea'","code":"invalid_kind"}}""",
        ).submit(kind = BeaconKind.Bug, title = "x", details = "", consent = false, appMeta = appMeta)
        assertTrue(result is BeaconResult.Failed)
        assertEquals(400, (result as BeaconResult.Failed).status)
    }

    // Retry + idempotency: a transient 500 is retried, and the clientReportId is IDENTICAL on every
    // attempt. That stable key is what makes a retry a server-side no-op (the alternate-key upsert) rather
    // than a duplicate intake row. runTest fast-forwards the retry backoff, so this stays instant.
    @Test
    fun retry_reusesSameClientReportId_untilSuccess() = runTest {
        val bodies = mutableListOf<String>()
        var attempt = 0
        val engine = MockEngine { request ->
            bodies += (request.body as? TextContent)?.text ?: ""
            attempt++
            if (attempt < 2) {
                respond(content = "", status = HttpStatusCode.InternalServerError)
            } else {
                respond(
                    content = """{"ok":true,"intakeNumber":"INT-9"}""",
                    status = HttpStatusCode.Accepted,
                    headers = headersOf(HttpHeaders.ContentType, "application/json"),
                )
            }
        }
        val result = BeaconClient(product = "fudemoji", platformContext = fixedCtx, engine = engine).submit(
            kind = BeaconKind.Bug, title = "retry", details = "", consent = false,
            appMeta = appMeta, clientReportId = "fixed-abc",
        )
        assertTrue(result is BeaconResult.Ok, "succeeds after the transient error is retried")
        assertTrue(bodies.size >= 2, "the 500 was retried at least once (attempts=${bodies.size})")
        assertTrue(
            bodies.all { it.contains("\"clientReportId\":\"fixed-abc\"") },
            "the idempotency key is stable across every retry attempt",
        )
    }
}

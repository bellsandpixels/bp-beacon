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
import kotlin.test.assertNull
import kotlin.test.assertTrue

// The two-phase attachment upload contract (cp-beacon-attachments), headless in commonTest so every
// target proves the exact wire behaviour: mint tickets -> PUT each image to its SAS -> submit with the
// refs, all sharing one clientReportId. A MockEngine routes by URL (ticket endpoint vs blob PUT vs
// submit) and captures the bodies. No emulator, no network. Mirrors the web SDK's attachments.test.ts.
class BeaconAttachmentsTest {
    private val fixedCtx = { PlatformContext(platform = "android", device = "phone", os = "android", osMajor = "Android 15", locale = "en-US") }
    private val appMeta = BeaconAppMeta(appName = "Fudemoji", appVersion = "0.1.27", env = "alpha", route = "/review")

    private val ticketEndpoint = "https://portal.test/api/beacon-attachment-ticket"
    private val signalEndpoint = "https://portal.test/api/beacon-signal"

    private fun png(bytes: Int) = BeaconAttachment(bytes = ByteArray(bytes) { 1 }, contentType = "image/png")

    // A client whose MockEngine answers the ticket mint with `ticketBody`, every blob PUT with `putStatus`,
    // and the submit with an OK. Captures the ticket request body, the PUT urls, and the submit body.
    private fun client(
        ticketBody: String,
        putStatus: (index: Int) -> HttpStatusCode = { HttpStatusCode.Created },
        onTicketReq: (String) -> Unit = {},
        onPutUrl: (String) -> Unit = {},
        onSubmit: (String) -> Unit = {},
    ): BeaconClient {
        var putSeen = 0
        val engine = MockEngine { request ->
            val url = request.url.toString()
            when {
                url.contains("beacon-attachment-ticket") -> {
                    onTicketReq((request.body as? TextContent)?.text ?: "")
                    respond(content = ticketBody, status = HttpStatusCode.OK, headers = headersOf(HttpHeaders.ContentType, "application/json"))
                }
                url.contains("blob.test") -> {
                    onPutUrl(url)
                    respond(content = "", status = putStatus(putSeen++))
                }
                else -> {
                    onSubmit((request.body as? TextContent)?.text ?: "")
                    respond(content = """{"ok":true,"intakeNumber":"INT-42"}""", status = HttpStatusCode.Accepted, headers = headersOf(HttpHeaders.ContentType, "application/json"))
                }
            }
        }
        return BeaconClient(product = "fudemoji", endpoint = signalEndpoint, ticketEndpoint = ticketEndpoint, platformContext = fixedCtx, engine = engine)
    }

    @Test
    fun validate_allowsImages_rejectsTypeAndSize() {
        assertNull(BeaconAttachments.validate("image/png", 1024))
        assertNull(BeaconAttachments.validate("image/jpeg", BeaconAttachments.MAX_BYTES))
        assertNull(BeaconAttachments.validate("image/webp", 1))
        assertTrue(BeaconAttachments.validate("application/pdf", 10)!!.contains("PNG"))
        assertTrue(BeaconAttachments.validate("image/gif", 10)!!.contains("PNG"))
        assertTrue(BeaconAttachments.validate("image/png", BeaconAttachments.MAX_BYTES + 1)!!.contains("10 MB"))
    }

    @Test
    fun uploadAttachments_mintsTickets_putsEach_returnsRefs() = runTest {
        var ticketReq = ""
        val puts = mutableListOf<String>()
        val c = client(
            ticketBody = """{"tickets":[{"attachmentId":"att-0","url":"https://blob.test/0"},{"attachmentId":"att-1","url":"https://blob.test/1"}]}""",
            onTicketReq = { ticketReq = it },
            onPutUrl = { puts += it },
        )
        val out = c.uploadAttachments(listOf(png(10), png(20)), clientReportId = "rep-1")

        assertEquals("rep-1", out.clientReportId)
        assertEquals(2, out.attachments.size, "both images uploaded")
        assertEquals(listOf("att-0", "att-1"), out.attachments.map { it.id }, "refs carry the minted ids in order")
        assertEquals(listOf(10L, 20L), out.attachments.map { it.bytes }, "refs carry the declared sizes")
        assertTrue(ticketReq.contains("\"clientReportId\":\"rep-1\""), "the mint request carries the shared id")
        assertTrue(ticketReq.contains("\"contentType\":\"image/png\""), "the mint request declares the file type")
        assertEquals(listOf("https://blob.test/0", "https://blob.test/1"), puts, "each image PUT to its own SAS url")
    }

    @Test
    fun uploadAttachments_skipsFailedPut_butKeepsTheRest() = runTest {
        val c = client(
            ticketBody = """{"tickets":[{"attachmentId":"att-0","url":"https://blob.test/0"},{"attachmentId":"att-1","url":"https://blob.test/1"}]}""",
            putStatus = { i -> if (i == 0) HttpStatusCode.Forbidden else HttpStatusCode.Created },
        )
        val out = c.uploadAttachments(listOf(png(10), png(20)), clientReportId = "rep-2")
        assertEquals(1, out.attachments.size, "the failed PUT is skipped, the other survives")
        assertEquals("att-1", out.attachments.single().id)
    }

    @Test
    fun uploadAttachments_capsAtThree() = runTest {
        var ticketReq = ""
        val c = client(
            ticketBody = """{"tickets":[{"attachmentId":"a0","url":"https://blob.test/0"},{"attachmentId":"a1","url":"https://blob.test/1"},{"attachmentId":"a2","url":"https://blob.test/2"}]}""",
            onTicketReq = { ticketReq = it },
        )
        val out = c.uploadAttachments(listOf(png(1), png(2), png(3), png(4)), clientReportId = "rep-3")
        assertTrue(out.attachments.size <= BeaconAttachments.MAX_ATTACHMENTS, "never more than the cap")
        // The 4th file is dropped before the mint: exactly three file entries are requested.
        assertEquals(3, Regex("\"contentType\"").findAll(ticketReq).count(), "only three files are ticketed")
    }

    @Test
    fun uploadAttachments_dropsInvalidBeforeMint() = runTest {
        var ticketReq = ""
        val c = client(
            ticketBody = """{"tickets":[{"attachmentId":"a0","url":"https://blob.test/0"}]}""",
            onTicketReq = { ticketReq = it },
        )
        val bad = BeaconAttachment(bytes = ByteArray(10), contentType = "application/pdf")
        val out = c.uploadAttachments(listOf(bad, png(5)), clientReportId = "rep-4")
        assertEquals(1, out.attachments.size, "only the valid image is uploaded")
        assertFalse(ticketReq.contains("application/pdf"), "the invalid file is never ticketed")
    }

    @Test
    fun noTicketEndpoint_disablesUpload() = runTest {
        val engine = MockEngine { respond(content = """{"ok":true,"intakeNumber":"INT-1"}""", status = HttpStatusCode.Accepted, headers = headersOf(HttpHeaders.ContentType, "application/json")) }
        val c = BeaconClient(product = "fudemoji", platformContext = fixedCtx, engine = engine)
        assertFalse(c.canUploadAttachments, "no picker without a ticket endpoint")
        val out = c.uploadAttachments(listOf(png(10)), clientReportId = "rep-5")
        assertTrue(out.attachments.isEmpty(), "nothing uploads when there is no ticket endpoint")
    }

    @Test
    fun submit_carriesAttachmentRefsOnTheWire() = runTest {
        var submitBody = ""
        val c = client(
            ticketBody = """{"tickets":[{"attachmentId":"att-0","url":"https://blob.test/0"}]}""",
            onSubmit = { submitBody = it },
        )
        val up = c.uploadAttachments(listOf(png(10)), clientReportId = "rep-6")
        val result = c.submit(
            kind = BeaconKind.Bug, title = "with image", details = "", consent = false,
            appMeta = appMeta, clientReportId = up.clientReportId, attachments = up.attachments,
        )
        assertTrue(result is BeaconResult.Ok)
        assertTrue(submitBody.contains("\"attachments\""), "the envelope carries the attachment refs")
        assertTrue(submitBody.contains("\"att-0\""), "the minted attachment id is on the envelope")
        assertTrue(submitBody.contains("\"clientReportId\":\"rep-6\""), "envelope and uploads share the id")
    }

    @Test
    fun submit_withNoAttachments_omitsTheField() = runTest {
        var submitBody = ""
        val c = client(ticketBody = "", onSubmit = { submitBody = it })
        c.submit(kind = BeaconKind.Idea, title = "no image", details = "", consent = false, appMeta = appMeta)
        assertFalse(submitBody.contains("\"attachments\""), "attachments is dropped when empty")
    }
}

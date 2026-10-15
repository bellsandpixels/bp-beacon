package com.bellsandpixels.beacon

import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

@Serializable
private data class BeaconResponse(
    val ok: Boolean = false,
    val intakeNumber: String? = null,
    val error: BeaconError? = null,
)

@Serializable
private data class BeaconError(val message: String? = null, val code: String? = null)

// The two-phase attachment ticket wire shapes (cp-beacon-attachments). Phase 1: POST the ticket
// endpoint with the clientReportId + the declared type/size of each file; it mints one write-only SAS
// per file. Phase 2 (below): PUT each image straight to its `url`. Mirrors the web adapter.ts flow and
// the portal's /api/beacon-attachment-ticket contract.
@Serializable
private data class TicketRequestFile(val contentType: String, val bytes: Long)

@Serializable
private data class TicketRequest(
    val clientReportId: String,
    val hp: String = "",
    val files: List<TicketRequestFile>,
)

@Serializable
private data class Ticket(val attachmentId: String? = null, val url: String? = null)

@Serializable
private data class TicketResponse(val tickets: List<Ticket> = emptyList())

// The Beacon feedback client. Assembles the consented envelope and POSTs it to the client-portal
// anonymous intake endpoint. Native apps call this endpoint DIRECTLY (no browser => no CORS), sending
// the same envelope the web Beacon sends through its forwarder.
//
// The 4a amendment lives here by construction: the only thing that can leave is a title, details, an
// optional consented allow-list context, and an idempotency UUID. There is no path that reads a card,
// a study session, an account, or a stable device id.
//
// `product` is host-supplied (the shared module serves every KMP product): the app passes its intake
// product tag ("fudemoji" | "bunko" | ...), which must be a value on the portal's bp_product option set.
class BeaconClient(
    private val product: String,
    private val endpoint: String = DEFAULT_ENDPOINT,
    // Where the attachment upload TICKETS are minted (cp-beacon-attachments): the portal's
    // /api/beacon-attachment-ticket (native posts it DIRECTLY - no browser, no CORS, no forwarder). Set
    // it to enable image attachments; when null, canUploadAttachments is false and the FeedbackPane hides
    // the image picker (graceful no-op, mirroring the web ticketEndpoint contract).
    private val ticketEndpoint: String? = null,
    // Injectable so tests can supply a fixed context without touching android.os.Build / UIDevice.
    private val platformContext: () -> PlatformContext = ::capturePlatformContext,
    engine: HttpClientEngine? = null,
) {
    // The FeedbackPane offers the image picker ONLY when a ticket endpoint is configured.
    val canUploadAttachments: Boolean get() = ticketEndpoint != null
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    private val http: HttpClient = run {
        val block: HttpClientConfig<*>.() -> Unit = {
            install(ContentNegotiation) { json(json) }
            // Generous timeouts: the neutral intake is a low-traffic serverless endpoint that spins down
            // when idle, so a first hit can pay an Azure Functions cold start (measured ~6s vs ~0.9s warm).
            // The default 10s-per-phase would fail that first submission (dogfood 2026-08-25). Give a cold
            // start room, and let the retry below cover any residual transient.
            install(HttpTimeout) {
                connectTimeoutMillis = 15_000
                requestTimeoutMillis = 30_000
                socketTimeoutMillis = 30_000
            }
            // Retry transient failures. The clientReportId is stable across retries, so the server's
            // alternate-key upsert (412 -> idempotent) makes a retry a no-op, never a duplicate row.
            install(HttpRequestRetry) {
                retryOnServerErrors(maxRetries = 2)
                retryOnExceptionIf { _, cause -> cause !is kotlin.coroutines.cancellation.CancellationException }
                exponentialDelay()
            }
        }
        // Pass the engine EXPLICITLY (never the no-arg HttpClient{} that relies on ServiceLoader engine
        // auto-discovery, which silently failed on Android - dogfood 2026-08-25). Tests inject a MockEngine.
        HttpClient(engine ?: beaconHttpEngine(), block)
    }

    @OptIn(ExperimentalUuidApi::class)
    suspend fun submit(
        kind: BeaconKind,
        title: String,
        details: String,
        consent: Boolean,
        appMeta: BeaconAppMeta,
        clientReportId: String = Uuid.random().toString(),
        // Refs to images already uploaded via uploadAttachments (cp-beacon-attachments). Pass the SAME
        // clientReportId that uploadAttachments returned so the envelope and the blobs share one id.
        attachments: List<BeaconAttachmentRef>? = null,
    ): BeaconResult {
        // Consent gate [D3]: attach the allow-list context ONLY on explicit consent.
        val context = if (consent) {
            val p = platformContext()
            BeaconContext(
                appName = appMeta.appName,
                appVersion = appMeta.appVersion,
                env = appMeta.env,
                platform = p.platform,
                device = p.device,
                os = p.os,
                osMajor = p.osMajor,
                locale = p.locale,
                route = appMeta.route,
            )
        } else {
            null
        }

        val envelope = BeaconEnvelope(
            product = product,
            kind = kind.wire,
            title = title,
            details = details,
            consent = consent,
            clientReportId = clientReportId,
            context = context,
            // Ride only when non-empty (explicitNulls = false drops it otherwise); the server re-verifies
            // each blob (existence, size, sniffed type) against this clientReportId's quarantine prefix.
            attachments = attachments?.takeIf { it.isNotEmpty() },
        )

        return try {
            val res: HttpResponse = http.post(endpoint) {
                contentType(ContentType.Application.Json)
                setBody(envelope)
            }
            val text = res.bodyAsText()
            if (res.status.isSuccess()) {
                val body = runCatching { json.decodeFromString(BeaconResponse.serializer(), text) }.getOrNull()
                BeaconResult.Ok(body?.intakeNumber)
            } else {
                val body = runCatching { json.decodeFromString(BeaconResponse.serializer(), text) }.getOrNull()
                BeaconResult.Failed(res.status.value, body?.error?.message ?: "Could not send that. Please try again.")
            }
        } catch (e: kotlin.coroutines.cancellation.CancellationException) {
            throw e
        } catch (e: Exception) {
            // Friendly message + a compact diagnostic tag (the exception type) so an alpha dogfooder can
            // report the actual transport failure (timeout, TLS, DNS) instead of an opaque generic error.
            BeaconResult.Failed(null, "Could not reach the server. Please try again. (${e::class.simpleName})")
        }
    }

    // Two-phase attachment upload (cp-beacon-attachments), the native mirror of the web adapter.ts flow.
    // Mint a shared clientReportId, request one write-only SAS per image from the ticket endpoint, then PUT
    // each image straight to blob. Returns the shared id + the refs that uploaded, which the caller passes
    // to submit(clientReportId = ..., attachments = ...) so the envelope and the blobs share one id.
    //
    // Best-effort per file: a failed PUT (or a ticket the server declined) is skipped, never thrown, so a
    // report can still be filed without that image. Returns an empty ref list (with the id) when there is
    // no ticket endpoint, no images pass validation, or the mint call fails. Native does NOT do a CORS
    // preflight, so unlike the web path this needs no storage CORS origin - only the SAS + network.
    @OptIn(ExperimentalUuidApi::class)
    suspend fun uploadAttachments(
        images: List<BeaconAttachment>,
        clientReportId: String = Uuid.random().toString(),
    ): BeaconUploadResult {
        val ticketEndpoint = this.ticketEndpoint
        // Drop anything past the cap or failing the image allow-list / size gate up front (the server
        // re-verifies regardless); if nothing survives there is nothing to mint.
        val valid = images.asSequence()
            .filter { BeaconAttachments.validate(it) == null }
            .take(BeaconAttachments.MAX_ATTACHMENTS)
            .toList()
        if (ticketEndpoint == null || valid.isEmpty()) return BeaconUploadResult(clientReportId, emptyList())

        // Phase 1: mint one write-only SAS per file. Tickets come back in files order (the server iterates
        // the request's files array in order), so index i pairs ticket i with file i.
        val tickets: List<Ticket> = try {
            val res: HttpResponse = http.post(ticketEndpoint) {
                contentType(ContentType.Application.Json)
                setBody(
                    TicketRequest(
                        clientReportId = clientReportId,
                        hp = "",
                        files = valid.map { TicketRequestFile(it.contentType, it.bytes.size.toLong()) },
                    ),
                )
            }
            if (res.status.isSuccess()) {
                val text = res.bodyAsText()
                runCatching { json.decodeFromString(TicketResponse.serializer(), text) }.getOrNull()?.tickets.orEmpty()
            } else {
                emptyList()
            }
        } catch (e: kotlin.coroutines.cancellation.CancellationException) {
            throw e
        } catch (_: Exception) {
            return BeaconUploadResult(clientReportId, emptyList())
        }

        // Phase 2: PUT each image straight to its SAS url. Skip any ticket missing its url/id or a PUT that
        // does not succeed.
        val refs = ArrayList<BeaconAttachmentRef>(valid.size)
        for (i in valid.indices) {
            val ticket = tickets.getOrNull(i) ?: continue
            val url = ticket.url ?: continue
            val id = ticket.attachmentId ?: continue
            val img = valid[i]
            try {
                val put: HttpResponse = http.put(url) {
                    header("x-ms-blob-type", "BlockBlob")
                    contentType(ContentType.parse(img.contentType))
                    setBody(img.bytes)
                }
                if (put.status.isSuccess()) {
                    refs.add(BeaconAttachmentRef(id = id, contentType = img.contentType, bytes = img.bytes.size.toLong()))
                }
            } catch (e: kotlin.coroutines.cancellation.CancellationException) {
                throw e
            } catch (_: Exception) {
                // skip a failed upload; the report can still be filed
            }
        }
        return BeaconUploadResult(clientReportId, refs)
    }

    fun close() {
        http.close()
    }

    companion object {
        // Prod portal endpoint. The former test tier (bpcp-test-swa) was decommissioned 2026-07-28
        // (client-portal decision #62), so prod is the only live target; override per build only for a
        // non-prod tier that actually exists.
        const val DEFAULT_ENDPOINT = "https://clientportal.bells-and-pixels.com/api/beacon-signal"

        // Prod portal attachment-ticket endpoint (cp-beacon-attachments). Native posts it directly (no
        // forwarder, no CORS). Pair it with DEFAULT_ENDPOINT unless a non-prod tier actually exists.
        const val DEFAULT_TICKET_ENDPOINT = "https://clientportal.bells-and-pixels.com/api/beacon-attachment-ticket"

        /**
         * Swift-friendly factory. Kotlin default constructor params are not exposed to Swift/ObjC, so the
         * SwiftUI Beacon builds the client through this instead of the multi-arg init (whose
         * `platformContext` closure is awkward from Swift). Pass the app's intake product tag.
         */
        fun createDefault(product: String): BeaconClient = BeaconClient(product = product)

        /**
         * Swift-friendly factory that ALSO enables image attachments by wiring the ticket endpoint
         * (cp-beacon-attachments). Use this when the pane should offer the picker; pass
         * DEFAULT_TICKET_ENDPOINT for prod.
         */
        fun createDefault(product: String, ticketEndpoint: String): BeaconClient =
            BeaconClient(product = product, ticketEndpoint = ticketEndpoint)
    }
}

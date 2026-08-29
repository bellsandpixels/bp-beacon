package com.bellsandpixels.beacon

import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.post
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
    // Injectable so tests can supply a fixed context without touching android.os.Build / UIDevice.
    private val platformContext: () -> PlatformContext = ::capturePlatformContext,
    engine: HttpClientEngine? = null,
) {
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

    fun close() {
        http.close()
    }

    companion object {
        // Prod portal endpoint. The former test tier (bpcp-test-swa) was decommissioned 2026-07-28
        // (client-portal decision #62), so prod is the only live target; override per build only for a
        // non-prod tier that actually exists.
        const val DEFAULT_ENDPOINT = "https://clientportal.bells-and-pixels.com/api/beacon-signal"

        /**
         * Swift-friendly factory. Kotlin default constructor params are not exposed to Swift/ObjC, so the
         * SwiftUI Beacon builds the client through this instead of the multi-arg init (whose
         * `platformContext` closure is awkward from Swift). Pass the app's intake product tag.
         */
        fun createDefault(product: String): BeaconClient = BeaconClient(product = product)
    }
}

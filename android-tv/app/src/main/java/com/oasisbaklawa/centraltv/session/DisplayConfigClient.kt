package com.oasisbaklawa.centraltv.session

import com.oasisbaklawa.centraltv.BuildConfig
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Polls the governed display-config bootstrap authority (Central Task 4).
 * Fail-closed: malformed, revoked, or unavailable responses are ignored.
 */
class DisplayConfigClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build(),
) {
    fun fetchAssignment(deviceId: String): FetchResult {
        val base = BuildConfig.DISPLAY_CONFIG_BOOTSTRAP_URL.trim()
        if (base.isBlank()) return FetchResult.Unconfigured

        val baseUrl = base.toHttpUrlOrNull()
            ?.takeIf { it.isHttps }
            ?: return FetchResult.Unavailable("bootstrap URL must be valid HTTPS")
        val url = baseUrl.newBuilder()
            .addPathSegments("v1/devices")
            .addPathSegment(deviceId)
            .addPathSegment("assignment")
            .build()
        val request = Request.Builder().url(url).get().build()
        return runCatching {
            http.newCall(request).execute().use { response ->
                when {
                    response.code == 404 -> FetchResult.PendingEnrollment
                    !response.isSuccessful -> FetchResult.Unavailable("HTTP ${response.code}")
                    else -> {
                        val body = response.body?.string().orEmpty()
                        val assignment = DisplayAssignment.fromJson(body)
                            ?.takeIf { it.surface != null }
                            ?: return FetchResult.Unavailable("malformed or unknown assignment payload")
                        FetchResult.Assigned(assignment)
                    }
                }
            }
        }.getOrElse { FetchResult.Unavailable(it.message ?: "network error") }
    }

    sealed interface FetchResult {
        data object Unconfigured : FetchResult
        data object PendingEnrollment : FetchResult
        data class Assigned(val assignment: DisplayAssignment) : FetchResult
        data class Unavailable(val reason: String) : FetchResult
    }
}

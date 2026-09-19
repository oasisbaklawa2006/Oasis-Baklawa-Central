package com.oasisbaklawa.centraltv.session

import com.oasisbaklawa.centraltv.BuildConfig
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
        .build(),
) {
    fun fetchAssignment(deviceId: String): FetchResult {
        val base = BuildConfig.DISPLAY_CONFIG_BOOTSTRAP_URL.trim()
        if (base.isBlank()) return FetchResult.Unconfigured

        val url = base.trimEnd('/') + "/v1/devices/" + deviceId + "/assignment"
        val request = Request.Builder().url(url).get().build()
        return runCatching {
            http.newCall(request).execute().use { response ->
                when {
                    response.code == 404 -> FetchResult.PendingEnrollment
                    !response.isSuccessful -> FetchResult.Unavailable("HTTP ${response.code}")
                    else -> {
                        val body = response.body?.string().orEmpty()
                        val assignment = DisplayAssignment.fromJson(body)
                            ?: return FetchResult.Unavailable("malformed assignment payload")
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

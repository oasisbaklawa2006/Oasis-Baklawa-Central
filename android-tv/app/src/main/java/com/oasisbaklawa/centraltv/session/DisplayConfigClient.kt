package com.oasisbaklawa.centraltv.session

import com.oasisbaklawa.centraltv.BuildConfig
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Polls the governed display-config bootstrap authority.
 * Fail-closed: invalid URL/TLS/auth, revoked devices, malformed payloads, and
 * unavailable responses never replace a previously governed assignment.
 */
class DisplayConfigClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build(),
) {
    fun fetchAssignment(
        deviceId: String,
        enrollmentCode: String,
        deviceToken: String?,
        apkVersion: String,
    ): FetchResult {
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

        val requestBuilder = Request.Builder()
            .url(url)
            .get()
            .header("X-Oasis-Apk-Version", apkVersion)

        if (!deviceToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer " + deviceToken)
        } else {
            requestBuilder.header("X-Oasis-Enrollment-Code", enrollmentCode)
        }

        return runCatching {
            http.newCall(requestBuilder.build()).execute().use { response ->
                when {
                    response.code == 404 -> FetchResult.PendingEnrollment
                    response.code == 401 -> FetchResult.Unauthorized
                    response.code == 403 -> FetchResult.Revoked
                    !response.isSuccessful -> FetchResult.Unavailable("HTTP " + response.code)
                    else -> {
                        val body = response.body?.string().orEmpty()
                        val assignment = DisplayAssignment.fromJson(body)
                            ?.takeIf { it.surface != null }
                            ?: return FetchResult.Unavailable("malformed or unknown assignment payload")
                        val token = runCatching {
                            JSONObject(body).optString("deviceToken")
                                .trim()
                                .takeIf { it.isNotEmpty() }
                        }.getOrNull()
                        FetchResult.Assigned(assignment, token)
                    }
                }
            }
        }.getOrElse { FetchResult.Unavailable(it.message ?: "network error") }
    }

    sealed interface FetchResult {
        data object Unconfigured : FetchResult
        data object PendingEnrollment : FetchResult
        data object Unauthorized : FetchResult
        data object Revoked : FetchResult
        data class Assigned(
            val assignment: DisplayAssignment,
            val deviceToken: String?,
        ) : FetchResult
        data class Unavailable(val reason: String) : FetchResult
    }
}

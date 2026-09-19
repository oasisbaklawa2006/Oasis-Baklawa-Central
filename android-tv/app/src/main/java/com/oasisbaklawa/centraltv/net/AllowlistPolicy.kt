package com.oasisbaklawa.centraltv.net

import com.oasisbaklawa.centraltv.BuildConfig
import java.net.URI

/**
 * HTTPS-only navigation allowlist for Central and Trace governed TV origins.
 */
object AllowlistPolicy {

    private val allowedHosts: Set<String> by lazy {
        setOf(
            hostOf(BuildConfig.CENTRAL_WEB_ORIGIN),
            hostOf(BuildConfig.TRACE_WEB_ORIGIN),
        ).filterNotNull().toSet()
    }

    internal fun hostOf(origin: String): String? =
        runCatching { URI(origin.trim()).host?.lowercase() }.getOrNull()

    internal fun isHostAllowed(host: String?, allowed: Set<String> = allowedHosts): Boolean {
        val normalized = host?.trim()?.lowercase() ?: return false
        return allowed.contains(normalized)
    }

    fun isNavigationAllowed(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { URI(url.trim()) }.getOrNull() ?: return false
        if (uri.scheme != "https") return false
        return isHostAllowed(uri.host)
    }

    fun isExternalHandoffAllowed(): Boolean = false
}

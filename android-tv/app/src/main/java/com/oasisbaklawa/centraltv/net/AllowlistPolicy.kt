package com.oasisbaklawa.centraltv.net

import android.net.Uri
import com.oasisbaklawa.centraltv.BuildConfig

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

    private fun hostOf(origin: String): String? =
        runCatching { Uri.parse(origin.trim()).host?.lowercase() }.getOrNull()

    fun isNavigationAllowed(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        if (uri.scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        return allowedHosts.contains(host)
    }

    fun isExternalHandoffAllowed(): Boolean = false
}

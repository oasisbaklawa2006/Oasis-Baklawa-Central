package com.oasisbaklawa.centraltv.net

import android.net.Uri
import com.oasisbaklawa.centraltv.BuildConfig

/**
 * Second, independent layer enforcing "no arbitrary URL navigation, no
 * external browser launches, HTTPS-only" -- on top of (not instead of)
 * network_security_config.xml's cleartext ban. Every navigation the WebView
 * is about to perform is checked here first; anything that fails is refused
 * in-app rather than handed to an external Activity/browser.
 */
object AllowlistPolicy {

    private val allowedOrigin: Uri by lazy { Uri.parse(BuildConfig.CENTRAL_WEB_ORIGIN) }

    fun isNavigationAllowed(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        if (uri.scheme != "https") return false
        if (uri.host.isNullOrBlank()) return false
        return uri.host.equals(allowedOrigin.host, ignoreCase = true)
    }

    /**
     * Anything that would leave the WebView -- mailto:, tel:, intent:, a
     * target=_blank window.open(), a download -- is rejected outright. The TV
     * has no legitimate reason to hand off to another app; it is a read-only
     * operational display, not a general browser.
     */
    fun isExternalHandoffAllowed(): Boolean = false
}

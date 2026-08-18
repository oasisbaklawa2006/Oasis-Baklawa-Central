package com.oasisbaklawa.centraltv.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.oasisbaklawa.centraltv.BuildConfig
import com.oasisbaklawa.centraltv.R
import com.oasisbaklawa.centraltv.net.AllowlistPolicy
import com.oasisbaklawa.centraltv.net.NetworkStateMonitor
import com.oasisbaklawa.centraltv.session.DeviceConfig
import kotlinx.coroutines.launch

/**
 * The entire app: one fullscreen kiosk WebView pointed at this device's
 * assigned Central TV route. Core stays the backend authority and Trace
 * stays the label/print authority -- this Activity's only job is to render
 * one governed web surface reliably, unattended, on a wall-mounted TV.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var offlineOverlay: View
    private lateinit var unassignedOverlay: View
    private lateinit var staleDataBadge: View
    private lateinit var deviceConfig: DeviceConfig

    private val retryHandler = Handler(Looper.getMainLooper())
    private var retryAttempt = 0
    private var lastSuccessfulLoadAt: Long = 0L

    private val backPressTimestamps = ArrayDeque<Long>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        deviceConfig = DeviceConfig(this)
        applyProvisioningExtrasIfPresent()

        webView = findViewById(R.id.webView)
        offlineOverlay = findViewById(R.id.offlineOverlay)
        unassignedOverlay = findViewById(R.id.unassignedOverlay)
        staleDataBadge = findViewById(R.id.staleDataBadge)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()
        attemptLockTaskMode()

        val targetUrl = deviceConfig.targetUrl()
        if (targetUrl == null) {
            showUnassignedState()
            return
        }

        configureWebView()
        loadTarget(targetUrl)
        observeNetworkState()
        scheduleGovernedReauthReload()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    /**
     * First-boot provisioning: `adb shell am start -n
     * com.oasisbaklawa.centraltv/.ui.MainActivity --es oasis_tv_department RGS`
     * (or ARABIC_SWEETS / CHOCOLATES_CONFECTIONERY / FUSION_SWEETS /
     * SEASONED_NUTS_MIXES / BAKERY). Persisted locally; only needed once per
     * device. See DEPARTMENTS.md.
     */
    private fun applyProvisioningExtrasIfPresent() {
        val extra = intent?.getStringExtra("oasis_tv_department") ?: return
        val department = com.oasisbaklawa.centraltv.session.TvDepartment.fromCode(extra)
        if (department != null) {
            deviceConfig.department = department
        } else {
            Log.w(TAG, "Ignoring unknown oasis_tv_department extra: $extra")
        }
    }

    private fun showUnassignedState() {
        unassignedOverlay.visibility = View.VISIBLE
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.webViewClient = KioskWebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            // Block target=_blank / window.open() -- the TV never hands off
            // to a second window or an external browser.
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?,
            ): Boolean = false
        }

        // Any download attempt is refused rather than handed to the system
        // download manager / an external app.
        webView.setDownloadListener { _, _, _, _, _ ->
            Log.w(TAG, "Blocked download attempt from WebView content")
        }
    }

    private fun loadTarget(url: String) {
        webView.loadUrl(url)
    }

    private inner class KioskWebViewClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            if (!AllowlistPolicy.isNavigationAllowed(url)) {
                Log.w(TAG, "Blocked disallowed navigation target: $url")
                return true // cancel navigation, stay on current page
            }
            return false // allow, load in this WebView (never externally)
        }

        override fun onPageFinished(view: WebView, url: String?) {
            super.onPageFinished(view, url)
            lastSuccessfulLoadAt = System.currentTimeMillis()
            retryAttempt = 0
            offlineOverlay.visibility = View.GONE
            staleDataBadge.visibility = View.GONE
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            super.onReceivedError(view, request, error)
            if (request.isForMainFrame) handleLoadFailure()
        }

        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            errorResponse: android.webkit.WebResourceResponse,
        ) {
            super.onReceivedHttpError(view, request, errorResponse)
            if (request.isForMainFrame && errorResponse.statusCode >= 500) handleLoadFailure()
        }

        // Fail closed: an untrusted TLS chain is refused, never silently
        // trusted, even for a display that carries no write authority.
        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            Log.e(TAG, "Refusing untrusted TLS certificate: $error")
            handler.cancel()
            handleLoadFailure()
        }
    }

    private fun handleLoadFailure() {
        staleDataBadge.visibility = View.VISIBLE
        scheduleRetry()
    }

    private fun scheduleRetry() {
        retryHandler.removeCallbacksAndMessages(RETRY_TOKEN)
        val delayMs = minOf(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (1L shl minOf(retryAttempt, 6)))
        retryAttempt += 1
        retryHandler.postDelayed(
            {
                val url = deviceConfig.targetUrl() ?: return@postDelayed
                webView.loadUrl(url)
            },
            RETRY_TOKEN,
            delayMs,
        )
    }

    private fun observeNetworkState() {
        lifecycleScope.launch {
            NetworkStateMonitor(this@MainActivity).observe().collect { online ->
                if (online) {
                    offlineOverlay.visibility = View.GONE
                    if (System.currentTimeMillis() - lastSuccessfulLoadAt > STALE_THRESHOLD_MS) {
                        scheduleRetry()
                    }
                } else {
                    offlineOverlay.visibility = View.VISIBLE
                }
            }
        }
    }

    /**
     * Forces a full reload on a fixed interval so a revoked/expired TV
     * session (revoked the ordinary way, via the existing governed Supabase
     * Auth admin flow -- no parallel session system is introduced here) is
     * re-checked by the web app's own RoleProtectedRoute/useAuth guard rather
     * than silently continuing to render a stale authenticated view.
     */
    private fun scheduleGovernedReauthReload() {
        retryHandler.postDelayed(
            object : Runnable {
                override fun run() {
                    val url = deviceConfig.targetUrl()
                    if (url != null) webView.loadUrl(url)
                    retryHandler.postDelayed(this, GOVERNED_REAUTH_INTERVAL_MS)
                }
            },
            GOVERNED_REAUTH_INTERVAL_MS,
        )
    }

    private fun enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    /**
     * Only takes effect if this app has been granted Device Owner / Lock Task
     * allowlist status via MDM/`dpm set-device-owner` on the physical unit --
     * that provisioning step is PHYSICAL-DEVICE-ONLY. Without it, this is a
     * safe no-op and the kiosk still runs fullscreen-immersive with the back
     * key suppressed below.
     */
    private fun attemptLockTaskMode() {
        runCatching {
            val dpm = getSystemService(DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            val admin = ComponentName(this, com.oasisbaklawa.centraltv.util.OasisDeviceAdminReceiver::class.java)
            if (dpm != null && dpm.isDeviceOwnerApp(packageName)) {
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                startLockTask()
            }
        }.onFailure { Log.i(TAG, "Lock task mode unavailable on this device: ${it.message}") }
    }

    // The kiosk never exits to the launcher on a stray remote BACK press.
    // Five presses within three seconds opens Diagnostics for on-site admin
    // troubleshooting; this is the only escape hatch.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val now = System.currentTimeMillis()
            backPressTimestamps.addLast(now)
            while (backPressTimestamps.isNotEmpty() && now - backPressTimestamps.first() > DIAGNOSTICS_GESTURE_WINDOW_MS) {
                backPressTimestamps.removeFirst()
            }
            if (backPressTimestamps.size >= DIAGNOSTICS_GESTURE_PRESSES) {
                backPressTimestamps.clear()
                startActivity(Intent(this, DiagnosticsActivity::class.java))
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        retryHandler.removeCallbacksAndMessages(null)
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "MainActivity"
        private const val RETRY_TOKEN = "retry"
        private const val BASE_RETRY_DELAY_MS = 2000L
        private const val MAX_RETRY_DELAY_MS = 60_000L
        private const val STALE_THRESHOLD_MS = 5 * 60_000L
        private const val GOVERNED_REAUTH_INTERVAL_MS = 6 * 60 * 60_000L
        private const val DIAGNOSTICS_GESTURE_WINDOW_MS = 3000L
        private const val DIAGNOSTICS_GESTURE_PRESSES = 5
    }
}

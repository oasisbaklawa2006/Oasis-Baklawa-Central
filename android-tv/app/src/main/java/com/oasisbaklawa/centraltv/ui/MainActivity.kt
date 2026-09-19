package com.oasisbaklawa.centraltv.ui

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.http.SslError
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
import android.widget.ImageView
import android.widget.TextView
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
import com.oasisbaklawa.centraltv.session.DisplayConfigClient
import com.oasisbaklawa.centraltv.util.EnrollmentQrEncoder
import com.oasisbaklawa.centraltv.util.OasisDeviceAdminReceiver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Single Oasis Display APK — fullscreen kiosk WebView for governed Central and Trace TV routes.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var offlineOverlay: View
    private lateinit var unassignedOverlay: View
    private lateinit var staleDataBadge: View
    private lateinit var deviceConfig: DeviceConfig
    private val configClient = DisplayConfigClient()

    private val retryHandler = Handler(Looper.getMainLooper())
    private var retryAttempt = 0
    private var retryRunnable: Runnable? = null
    private var configRefreshRunnable: Runnable? = null
    private var assignmentRefreshJob: Job? = null
    private var lastSuccessfulLoadAt: Long = 0L
    private var kioskInitialized = false

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

        if (!ensureAssignedAndEnterKiosk(forceReload = true)) {
            showEnrollmentState()
            scheduleConfigRefresh()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val previousKey = deviceConfig.assignment?.surfaceKey
        applyProvisioningExtrasIfPresent()
        val nextKey = deviceConfig.assignment?.surfaceKey
        if (nextKey != previousKey) {
            Log.i(TAG, "Display assignment changed: $previousKey -> $nextKey")
            recreate()
        }
    }

    private fun applyProvisioningExtrasIfPresent() {
        intent?.getStringExtra(EXTRA_ASSIGNMENT_JSON)?.let { raw ->
            if (deviceConfig.applyAssignmentJson(raw)) return
        }
        intent?.getStringExtra(EXTRA_LEGACY_DEPARTMENT)?.let { code ->
            deviceConfig.applyLegacyDepartment(code)
        }
    }

    private fun showEnrollmentState() {
        unassignedOverlay.visibility = View.VISIBLE
        webView.visibility = View.GONE
        findViewById<TextView>(R.id.enrollmentDeviceId).text = deviceConfig.deviceId
        findViewById<TextView>(R.id.enrollmentCode).text = deviceConfig.enrollmentCode
        val payload = JSONObject()
            .put("v", 1)
            .put("deviceId", deviceConfig.deviceId)
            .put("enrollCode", deviceConfig.enrollmentCode)
            .toString()
        findViewById<ImageView>(R.id.enrollmentQr).setImageBitmap(
            EnrollmentQrEncoder.encode(payload, 512),
        )
    }

    private fun ensureAssignedAndEnterKiosk(forceReload: Boolean): Boolean {
        val targetUrl = deviceConfig.targetUrl()
        if (targetUrl == null) return false

        unassignedOverlay.visibility = View.GONE
        webView.visibility = View.VISIBLE

        if (!kioskInitialized) {
            configureWebView()
            observeNetworkState()
            scheduleGovernedReauthReload()
            scheduleConfigRefresh()
            kioskInitialized = true
        }

        if (forceReload) loadTarget(targetUrl)
        return true
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
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?,
            ): Boolean = false
        }
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
                return true
            }
            return false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            super.onPageFinished(view, url)
            lastSuccessfulLoadAt = System.currentTimeMillis()
            deviceConfig.recordSuccessfulDataRefresh(lastSuccessfulLoadAt)
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

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            Log.e(TAG, "Refusing untrusted TLS certificate: $error")
            handler.cancel()
            handleLoadFailure()
        }
    }

    private fun handleLoadFailure() {
        staleDataBadge.visibility = View.VISIBLE
        offlineOverlay.visibility = View.VISIBLE
        scheduleRetry()
    }

    private fun scheduleRetry() {
        retryRunnable?.let { retryHandler.removeCallbacks(it) }
        val delayMs = minOf(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (1L shl minOf(retryAttempt, 6)))
        retryAttempt += 1
        val runnable = Runnable {
            val url = deviceConfig.targetUrl()
            if (url == null) {
                showEnrollmentState()
            } else {
                webView.loadUrl(url)
            }
        }
        retryRunnable = runnable
        retryHandler.postDelayed(runnable, delayMs)
    }

    private fun observeNetworkState() {
        lifecycleScope.launch {
            NetworkStateMonitor(this@MainActivity).observe().collect { online ->
                if (online) {
                    if (deviceConfig.targetUrl() == null) {
                        refreshRemoteAssignment()
                    } else if (System.currentTimeMillis() - lastSuccessfulLoadAt > STALE_THRESHOLD_MS) {
                        scheduleRetry()
                    } else {
                        offlineOverlay.visibility = View.GONE
                    }
                } else {
                    offlineOverlay.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun scheduleConfigRefresh() {
        if (configRefreshRunnable != null) return
        val runnable = object : Runnable {
            override fun run() {
                refreshRemoteAssignment()
                retryHandler.postDelayed(this, CONFIG_REFRESH_INTERVAL_MS)
            }
        }
        configRefreshRunnable = runnable
        retryHandler.postDelayed(runnable, CONFIG_REFRESH_INTERVAL_MS)
    }

    private fun refreshRemoteAssignment() {
        if (assignmentRefreshJob?.isActive == true) return
        assignmentRefreshJob = lifecycleScope.launch(Dispatchers.IO) {
            try {
                when (val result = configClient.fetchAssignment(deviceConfig.deviceId)) {
                    is DisplayConfigClient.FetchResult.Assigned -> {
                        val previous = deviceConfig.assignment?.configVersion
                        deviceConfig.assignment = result.assignment
                        withContext(Dispatchers.Main) {
                            if (previous != result.assignment.configVersion || !kioskInitialized) {
                                ensureAssignedAndEnterKiosk(forceReload = true)
                            }
                        }
                    }
                    is DisplayConfigClient.FetchResult.PendingEnrollment -> withContext(Dispatchers.Main) {
                        if (deviceConfig.targetUrl() == null) showEnrollmentState()
                    }
                    else -> Unit
                }
            } finally {
                withContext(Dispatchers.Main) {
                    assignmentRefreshJob = null
                }
            }
        }
    }

    private fun scheduleGovernedReauthReload() {
        retryHandler.postDelayed(
            object : Runnable {
                override fun run() {
                    deviceConfig.targetUrl()?.let { webView.loadUrl(it) }
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

    private fun attemptLockTaskMode() {
        runCatching {
            val dpm = getSystemService(DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            val admin = ComponentName(this, OasisDeviceAdminReceiver::class.java)
            if (dpm != null && dpm.isDeviceOwnerApp(packageName)) {
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                startLockTask()
            }
        }.onFailure { Log.i(TAG, "Lock task mode unavailable on this device: ${it.message}") }
    }

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
        const val EXTRA_ASSIGNMENT_JSON = "oasis_display_assignment"
        const val EXTRA_LEGACY_DEPARTMENT = "oasis_tv_department"
        private const val BASE_RETRY_DELAY_MS = 2000L
        private const val MAX_RETRY_DELAY_MS = 60_000L
        private const val STALE_THRESHOLD_MS = 5 * 60_000L
        private const val GOVERNED_REAUTH_INTERVAL_MS = 6 * 60 * 60_000L
        private const val CONFIG_REFRESH_INTERVAL_MS = 5 * 60_000L
        private const val DIAGNOSTICS_GESTURE_WINDOW_MS = 3000L
        private const val DIAGNOSTICS_GESTURE_PRESSES = 5
    }
}

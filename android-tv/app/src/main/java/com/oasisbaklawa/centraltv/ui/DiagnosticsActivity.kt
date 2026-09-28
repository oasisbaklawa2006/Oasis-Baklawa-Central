package com.oasisbaklawa.centraltv.ui

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.oasisbaklawa.centraltv.BuildConfig
import com.oasisbaklawa.centraltv.R
import com.oasisbaklawa.centraltv.session.DeviceConfig
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** PIN-free diagnostics — reached via hidden 5x-BACK gesture. No secrets are shown. */
class DiagnosticsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_diagnostics)

        val deviceConfig = DeviceConfig(this)
        val assignment = deviceConfig.assignment
        val surface = assignment?.surface
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())

        findViewById<TextView>(R.id.diagnosticsText).text = buildString {
            appendLine("App version           : ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
            appendLine("Build type            : ${BuildConfig.BUILD_TYPE}")
            appendLine("Central origin        : ${BuildConfig.CENTRAL_WEB_ORIGIN}")
            appendLine("Trace origin          : ${BuildConfig.TRACE_WEB_ORIGIN}")
            appendLine("Config bootstrap      : ${BuildConfig.DISPLAY_CONFIG_BOOTSTRAP_URL.ifBlank { "(disabled)" }}")
            appendLine("Device id             : ${deviceConfig.deviceId}")
            appendLine("Enrollment code       : ${deviceConfig.enrollmentCode}")
            appendLine("Friendly name         : ${deviceConfig.friendlyName ?: assignment?.friendlyName ?: "-"}")
            appendLine("Location              : ${deviceConfig.location ?: assignment?.location ?: "-"}")
            appendLine("Assigned surface      : ${surface?.label ?: "UNASSIGNED"}")
            appendLine("Surface key           : ${assignment?.surfaceKey ?: "-"}")
            appendLine("Surface certification : ${surface?.certification ?: "-"}")
            appendLine("Resolved route        : ${surface?.routePath ?: "-"}")
            appendLine("Resolved host         : ${deviceConfig.resolvedHost() ?: "-"}")
            appendLine("Target URL            : ${deviceConfig.targetUrl() ?: "-"}")
            appendLine("Config version        : ${assignment?.configVersion ?: "-"}")
            appendLine("Last config refresh   : ${formatTs(deviceConfig.lastConfigRefreshMs)}")
            appendLine("Last data refresh     : ${formatTs(deviceConfig.lastSuccessfulDataRefreshMs)}")
            appendLine("Diag opened           : $timestamp")
        }
    }

    private fun formatTs(epochMs: Long): String {
        if (epochMs <= 0L) return "-"
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(epochMs))
    }
}

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

/** On-site troubleshooting screen -- reached only via the hidden 5x-BACK gesture in MainActivity. */
class DiagnosticsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_diagnostics)

        val deviceConfig = DeviceConfig(this)
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())

        findViewById<TextView>(R.id.diagnosticsText).text = buildString {
            appendLine("App version   : ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
            appendLine("Build type    : ${BuildConfig.BUILD_TYPE}")
            appendLine("Web origin    : ${BuildConfig.CENTRAL_WEB_ORIGIN}")
            appendLine("Device id     : ${deviceConfig.deviceId}")
            appendLine("Department    : ${deviceConfig.department?.displayName ?: "UNASSIGNED"}")
            appendLine("Target route  : ${deviceConfig.department?.routePath ?: "-"}")
            appendLine("Diag opened   : $timestamp")
        }
    }
}

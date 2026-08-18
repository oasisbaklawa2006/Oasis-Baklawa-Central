package com.oasisbaklawa.centraltv.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.oasisbaklawa.centraltv.ui.MainActivity
import kotlin.system.exitProcess

/**
 * Unattended kiosk devices cannot rely on someone walking over to relaunch a
 * crashed app. This installs itself as the process-wide uncaught-exception
 * handler: log, schedule a restart Intent a couple of seconds out (giving the
 * crashing process time to fully die first), then terminate this process.
 */
class CrashRecoveryHandler(private val appContext: Context) : Thread.UncaughtExceptionHandler {

    fun install() {
        Thread.setDefaultUncaughtExceptionHandler(this)
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        Log.e(TAG, "Uncaught exception -- scheduling kiosk restart", throwable)

        runCatching {
            val restartIntent = Intent(appContext, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
            val pendingIntent = PendingIntent.getActivity(
                appContext,
                RESTART_REQUEST_CODE,
                restartIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
            )
            val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.ELAPSED_REALTIME,
                SystemClock.elapsedRealtime() + RESTART_DELAY_MS,
                pendingIntent,
            )
        }.onFailure { Log.e(TAG, "Failed to schedule kiosk restart", it) }

        // Deliberately does not chain into the platform default handler: on
        // an unattended kiosk device, that would surface the system's "app
        // has stopped" crash dialog and sit there waiting for a tap nobody
        // is there to give. The scheduled restart + immediate process exit
        // is the entire recovery path.
        exitProcess(1)
    }

    companion object {
        private const val TAG = "CrashRecoveryHandler"
        private const val RESTART_REQUEST_CODE = 4200
        private const val RESTART_DELAY_MS = 2000L
    }
}

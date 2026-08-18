package com.oasisbaklawa.centraltv.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.oasisbaklawa.centraltv.ui.MainActivity

/**
 * Auto-launch after boot/power recovery. Android TV launchers normally start
 * the leanback-launcher app automatically, but a dedicated read-only kiosk
 * device should never sit on the system launcher after an unattended reboot
 * (power blip, brown-out, forced update) -- it must come back showing its
 * assigned production TV, unattended.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        context.startActivity(launchIntent)
    }
}

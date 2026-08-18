package com.oasisbaklawa.centraltv.util

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Required for lock-task/kiosk mode: MainActivity.attemptLockTaskMode() only
 * calls DevicePolicyManager.setLockTaskPackages() when this app is Device
 * Owner, which in turn requires a real, manifest-registered
 * DeviceAdminReceiver as the admin component (an ordinary BroadcastReceiver
 * cannot be passed there). Becoming Device Owner itself is a
 * PHYSICAL-DEVICE-ONLY provisioning step (`dpm set-device-owner` on a
 * freshly-reset device, or MDM enrollment) -- this class just makes that
 * provisioning possible; it grants nothing on its own.
 */
class OasisDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device admin disabled")
    }

    companion object {
        private const val TAG = "OasisDeviceAdmin"
    }
}

package com.oasisbaklawa.centraltv.session

import android.content.Context
import android.content.SharedPreferences
import com.oasisbaklawa.centraltv.BuildConfig

/**
 * One canonical entry per TV in the owner's six-TV estate (Central issue
 * #368). Route paths mirror Oasis-Baklawa-Central's src/App.tsx tv routes
 * exactly -- keep both in sync by hand, same discipline as the web client's
 * RAW_VALUE_TO_TV_GROUP / canonical_production_department() mirror.
 */
enum class TvDepartment(val code: String, val routePath: String, val displayName: String) {
    ARABIC_SWEETS("ARABIC_SWEETS", "/tv/arabic-sweets", "Arabic Sweets"),
    CHOCOLATES_CONFECTIONERY("CHOCOLATES_CONFECTIONERY", "/tv/chocolate", "Chocolates & Confectionery"),
    FUSION_SWEETS("FUSION_SWEETS", "/tv/fusion", "Fusion Sweets"),
    SEASONED_NUTS_MIXES("SEASONED_NUTS_MIXES", "/tv/nuts", "Seasoned Nuts & Mixes"),
    BAKERY("BAKERY", "/tv/bakery", "Bakery"),
    RGS("RGS", "/tv/rgs", "Ready Goods Store");

    companion object {
        fun fromCode(code: String?): TvDepartment? = entries.firstOrNull { it.code == code?.trim()?.uppercase() }
    }
}

/**
 * Per-device configuration: which of the six TVs this physical unit is, and
 * the device's own identity for session/audit purposes. Set once during
 * provisioning (ADB extras on first boot, or a future lightweight setup
 * screen) and persisted locally -- this is NOT synced from a human user
 * login, matching the "dedicated read-only TV device identity" requirement.
 */
class DeviceConfig(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("oasis_tv_device_config", Context.MODE_PRIVATE)

    var department: TvDepartment?
        get() = TvDepartment.fromCode(prefs.getString(KEY_DEPARTMENT, null))
        set(value) = prefs.edit().putString(KEY_DEPARTMENT, value?.code).apply()

    /** Stable per-device identifier, generated once, used for audit/session correlation. */
    val deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, null) ?: generateAndStoreDeviceId()

    private fun generateAndStoreDeviceId(): String {
        val id = "tv-" + java.util.UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
        return id
    }

    fun targetUrl(): String? {
        val dept = department ?: return null
        return BuildConfig.CENTRAL_WEB_ORIGIN.trimEnd('/') + dept.routePath
    }

    companion object {
        private const val KEY_DEPARTMENT = "department_code"
        private const val KEY_DEVICE_ID = "device_id"
    }
}

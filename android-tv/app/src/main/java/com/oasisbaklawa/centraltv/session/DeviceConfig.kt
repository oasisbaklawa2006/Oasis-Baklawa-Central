package com.oasisbaklawa.centraltv.session

import android.content.Context
import android.content.SharedPreferences
import com.oasisbaklawa.centraltv.BuildConfig

/**
 * Per-device display identity and governed assignment.
 * TV is a display identity — no permanent staff username/password is stored here.
 */
class DeviceConfig(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** Stable per-device identifier, generated once. */
    val deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, null) ?: generateAndStoreDeviceId()

    /** Random operator-facing enrollment secret, generated once and stored privately. */
    val enrollmentCode: String
        get() = prefs.getString(KEY_ENROLLMENT_CODE, null) ?: generateAndStoreEnrollmentCode()

    /** Read-only remote-config token returned once after governed enrollment. */
    var deviceToken: String?
        get() = prefs.getString(KEY_DEVICE_TOKEN, null)
        set(value) {
            val editor = prefs.edit()
            if (value.isNullOrBlank()) editor.remove(KEY_DEVICE_TOKEN)
            else editor.putString(KEY_DEVICE_TOKEN, value)
            editor.apply()
        }

    var assignment: DisplayAssignment?
        get() {
            migrateLegacyDepartmentIfNeeded()
            val raw = prefs.getString(KEY_ASSIGNMENT_JSON, null) ?: return null
            return DisplayAssignment.fromJson(raw)
        }
        set(value) {
            if (value == null) {
                prefs.edit().remove(KEY_ASSIGNMENT_JSON).apply()
            } else {
                prefs.edit()
                    .putString(KEY_ASSIGNMENT_JSON, DisplayAssignment.toJson(value))
                    .putLong(KEY_LAST_CONFIG_REFRESH_MS, System.currentTimeMillis())
                    .apply()
            }
        }

    var friendlyName: String?
        get() = prefs.getString(KEY_FRIENDLY_NAME, null)
        set(value) = prefs.edit().putString(KEY_FRIENDLY_NAME, value).apply()

    var location: String?
        get() = prefs.getString(KEY_LOCATION, null)
        set(value) = prefs.edit().putString(KEY_LOCATION, value).apply()

    val lastConfigRefreshMs: Long
        get() = prefs.getLong(KEY_LAST_CONFIG_REFRESH_MS, 0L)

    val lastSuccessfulDataRefreshMs: Long
        get() = prefs.getLong(KEY_LAST_DATA_REFRESH_MS, 0L)

    fun recordSuccessfulDataRefresh(nowMs: Long = System.currentTimeMillis()) {
        prefs.edit().putLong(KEY_LAST_DATA_REFRESH_MS, nowMs).apply()
    }

    fun targetUrl(): String? {
        val current = assignment ?: return null
        val surface = current.surface ?: return null
        if (!current.isCertifiedForProduction() && surface.certification == SurfaceCertification.PREVIEW) {
            // Preview surfaces may load in the shell but must never be certified as production-ready.
        }
        val origin = when (surface.originKind) {
            WebOriginKind.CENTRAL -> BuildConfig.CENTRAL_WEB_ORIGIN
            WebOriginKind.TRACE -> BuildConfig.TRACE_WEB_ORIGIN
        }.trimEnd('/')
        return origin + surface.routePath
    }

    fun resolvedHost(): String? = targetUrl()?.let { android.net.Uri.parse(it).host }

    fun applyAssignmentJson(raw: String): Boolean {
        val parsed = DisplayAssignment.fromJson(raw) ?: return false
        if (parsed.surface == null) return false
        assignment = parsed
        if (parsed.friendlyName != null) friendlyName = parsed.friendlyName
        if (parsed.location != null) location = parsed.location
        return true
    }

    /** Backward-compatible department provisioning via ADB extra. */
    fun applyLegacyDepartment(code: String?): Boolean {
        val surface = DisplaySurfaceRegistry.findByLegacyDepartment(code) ?: return false
        assignment = DisplayAssignment(
            version = DisplayAssignment.CURRENT_VERSION,
            surfaceKey = surface.key,
            friendlyName = surface.label,
            location = null,
            configVersion = 1L,
            assignedAtEpochMs = System.currentTimeMillis(),
        )
        return true
    }

    private fun migrateLegacyDepartmentIfNeeded() {
        if (prefs.contains(KEY_ASSIGNMENT_JSON)) return
        val legacy = prefs.getString(KEY_LEGACY_DEPARTMENT, null) ?: return
        applyLegacyDepartment(legacy)
        prefs.edit().remove(KEY_LEGACY_DEPARTMENT).apply()
    }

    private fun generateAndStoreDeviceId(): String {
        val id = "tv-" + java.util.UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
        return id
    }

    private fun generateAndStoreEnrollmentCode(): String {
        val code = java.util.UUID.randomUUID()
            .toString()
            .replace("-", "")
            .take(12)
            .uppercase()
        prefs.edit().putString(KEY_ENROLLMENT_CODE, code).apply()
        return code
    }

    companion object {
        private const val PREFS_NAME = "oasis_tv_device_config"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_ENROLLMENT_CODE = "enrollment_code"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_ASSIGNMENT_JSON = "assignment_json"
        private const val KEY_FRIENDLY_NAME = "friendly_name"
        private const val KEY_LOCATION = "location"
        private const val KEY_LAST_CONFIG_REFRESH_MS = "last_config_refresh_ms"
        private const val KEY_LAST_DATA_REFRESH_MS = "last_data_refresh_ms"
        private const val KEY_LEGACY_DEPARTMENT = "department_code"
    }
}

/** @deprecated Use [DeviceConfig.assignment] — kept for legacy call sites during migration. */
var DeviceConfig.department: TvDepartment?
    get() {
        val key = assignment?.surfaceKey ?: return null
        val legacy = DisplaySurfaceRegistry.findByKey(key)?.legacyDepartmentCode ?: return null
        return TvDepartment.fromCode(legacy)
    }
    set(value) {
        applyLegacyDepartment(value?.code)
    }

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

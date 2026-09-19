package com.oasisbaklawa.centraltv.session

import org.json.JSONObject

/**
 * Remote/local display assignment payload (v1 contract).
 * Does not carry staff credentials — display session auth is a separate Task 4 concern.
 */
data class DisplayAssignment(
    val version: Int,
    val surfaceKey: String,
    val friendlyName: String?,
    val location: String?,
    val configVersion: Long,
    val assignedAtEpochMs: Long,
) {
    val surface: DisplaySurfaceDefinition?
        get() = DisplaySurfaceRegistry.findByKey(surfaceKey)

    fun isCertifiedForProduction(): Boolean {
        val def = surface ?: return false
        return def.certification == SurfaceCertification.CANONICAL ||
            def.certification == SurfaceCertification.EXTERNAL_TRACE
    }

    companion object {
        const val CURRENT_VERSION = 1

        fun fromJson(raw: String): DisplayAssignment? = runCatching {
            val json = JSONObject(raw)
            val version = json.optInt("v", json.optInt("version", -1))
            if (version != CURRENT_VERSION) return null
            val surfaceKey = json.optString("surfaceKey").ifBlank { return null }
            DisplayAssignment(
                version = version,
                surfaceKey = surfaceKey,
                friendlyName = json.optString("friendlyName").ifBlank { null },
                location = json.optString("location").ifBlank { null },
                configVersion = json.optLong("configVersion", 1L),
                assignedAtEpochMs = json.optLong("assignedAtEpochMs", System.currentTimeMillis()),
            )
        }.getOrNull()

        fun toJson(assignment: DisplayAssignment): String = JSONObject()
            .put("v", assignment.version)
            .put("surfaceKey", assignment.surfaceKey)
            .put("friendlyName", assignment.friendlyName)
            .put("location", assignment.location)
            .put("configVersion", assignment.configVersion)
            .put("assignedAtEpochMs", assignment.assignedAtEpochMs)
            .toString()
    }
}

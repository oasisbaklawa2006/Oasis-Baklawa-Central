package com.oasisbaklawa.centraltv.session

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

        fun fromJson(raw: String): DisplayAssignment? {
            val trimmed = raw.trim()
            if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null
            val version = readInt(trimmed, "v") ?: readInt(trimmed, "version") ?: return null
            if (version != CURRENT_VERSION) return null
            val surfaceKey = readString(trimmed, "surfaceKey")?.trim()?.takeIf { it.isNotEmpty() }
                ?: return null
            return DisplayAssignment(
                version = version,
                surfaceKey = surfaceKey,
                friendlyName = readString(trimmed, "friendlyName")?.trim()?.takeIf { it.isNotEmpty() },
                location = readString(trimmed, "location")?.trim()?.takeIf { it.isNotEmpty() },
                configVersion = readLong(trimmed, "configVersion") ?: 1L,
                assignedAtEpochMs = readLong(trimmed, "assignedAtEpochMs") ?: System.currentTimeMillis(),
            )
        }

        fun toJson(assignment: DisplayAssignment): String = buildString {
            append('{')
            append("\"v\":").append(assignment.version).append(',')
            append("\"surfaceKey\":\"").append(escape(assignment.surfaceKey)).append('"')
            assignment.friendlyName?.let {
                append(",\"friendlyName\":\"").append(escape(it)).append('"')
            }
            assignment.location?.let {
                append(",\"location\":\"").append(escape(it)).append('"')
            }
            append(",\"configVersion\":").append(assignment.configVersion)
            append(",\"assignedAtEpochMs\":").append(assignment.assignedAtEpochMs)
            append('}')
        }

        private fun escape(value: String): String =
            value.replace("\\", "\\\\").replace("\"", "\\\"")

        private fun readString(json: String, key: String): String? {
            val pattern = Regex(""""$key"\s*:\s*"((?:\\.|[^"\\])*)"""")
            return pattern.find(json)?.groupValues?.get(1)?.replace("\\\"", "\"")
        }

        private fun readInt(json: String, key: String): Int? =
            Regex(""""$key"\s*:\s*(-?\d+)""").find(json)?.groupValues?.get(1)?.toIntOrNull()

        private fun readLong(json: String, key: String): Long? =
            Regex(""""$key"\s*:\s*(-?\d+)""").find(json)?.groupValues?.get(1)?.toLongOrNull()
    }
}

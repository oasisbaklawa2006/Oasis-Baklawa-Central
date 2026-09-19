package com.oasisbaklawa.centraltv.session

/**
 * Governed Appverse TV surface catalog for the single Oasis Display APK.
 * Keep route paths aligned with Central `tvSurfaces.ts` and Trace TV routes.
 */
enum class SurfaceCertification {
    CANONICAL,
    PREVIEW,
    EXTERNAL_TRACE,
}

enum class WebOriginKind {
    CENTRAL,
    TRACE,
}

data class DisplaySurfaceDefinition(
    val key: String,
    val label: String,
    val routePath: String,
    val originKind: WebOriginKind,
    val certification: SurfaceCertification,
    val legacyDepartmentCode: String? = null,
)

object DisplaySurfaceRegistry {
    val surfaces: List<DisplaySurfaceDefinition> = listOf(
        DisplaySurfaceDefinition("arabic-sweets", "Arabic Sweets Line", "/tv/arabic-sweets", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "ARABIC_SWEETS"),
        DisplaySurfaceDefinition("chocolate", "Chocolate Line", "/tv/chocolate", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "CHOCOLATES_CONFECTIONERY"),
        DisplaySurfaceDefinition("fusion", "Fusion Sweets Line", "/tv/fusion", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "FUSION_SWEETS"),
        DisplaySurfaceDefinition("nuts", "Nuts & Dry Fruits Line", "/tv/nuts", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "SEASONED_NUTS_MIXES"),
        DisplaySurfaceDefinition("bakery", "Bakery Line", "/tv/bakery", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "BAKERY"),
        DisplaySurfaceDefinition("ready-goods", "Ready Goods Store TV", "/tv/rgs", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL, "RGS"),
        DisplaySurfaceDefinition("third-party", "Third Party Goods Store TV", "/tv/3pgs", WebOriginKind.CENTRAL, SurfaceCertification.CANONICAL),
        DisplaySurfaceDefinition("assembly", "Assembly TV", "/admin/assembly-tv", WebOriginKind.CENTRAL, SurfaceCertification.PREVIEW),
        DisplaySurfaceDefinition("dispatch-central", "Dispatch TV (Central)", "/admin/dispatch-tv", WebOriginKind.CENTRAL, SurfaceCertification.PREVIEW),
        DisplaySurfaceDefinition("trace-gate", "Trace Gate Display", "/tv/gate", WebOriginKind.TRACE, SurfaceCertification.EXTERNAL_TRACE),
        DisplaySurfaceDefinition("trace-dispatch", "Trace Dispatch Display", "/tv/dispatch", WebOriginKind.TRACE, SurfaceCertification.EXTERNAL_TRACE),
    )

    fun findByKey(key: String?): DisplaySurfaceDefinition? =
        surfaces.firstOrNull { it.key == key?.trim()?.lowercase() }

    fun findByLegacyDepartment(code: String?): DisplaySurfaceDefinition? =
        surfaces.firstOrNull { it.legacyDepartmentCode == code?.trim()?.uppercase() }
}

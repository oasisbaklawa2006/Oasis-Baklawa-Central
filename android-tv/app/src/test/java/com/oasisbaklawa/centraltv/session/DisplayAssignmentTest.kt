package com.oasisbaklawa.centraltv.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DisplayAssignmentTest {
    @Test
    fun parsesValidAssignmentJson() {
        val json = """{"v":1,"surfaceKey":"trace-gate","friendlyName":"Gate TV 01","location":"Gate A","configVersion":3,"assignedAtEpochMs":1000}"""
        val parsed = DisplayAssignment.fromJson(json)
        assertNotNull(parsed)
        assertEquals("trace-gate", parsed?.surfaceKey)
        assertEquals("Gate TV 01", parsed?.friendlyName)
        assertTrue(parsed?.isCertifiedForProduction() == true)
    }

    @Test
    fun rejectsPreviewSurfaceForProductionCertification() {
        val json = """{"v":1,"surfaceKey":"assembly","configVersion":1}"""
        val parsed = requireNotNull(DisplayAssignment.fromJson(json))
        assertFalse(parsed.isCertifiedForProduction())
    }

    @Test
    fun rejectsMalformedVersion() {
        assertNull(DisplayAssignment.fromJson("""{"v":99,"surfaceKey":"ready-goods"}"""))
    }
}

class DisplaySurfaceRegistryTest {
    @Test
    fun includesTraceAndCentralSurfaces() {
        assertNotNull(DisplaySurfaceRegistry.findByKey("trace-gate"))
        assertNotNull(DisplaySurfaceRegistry.findByKey("ready-goods"))
        assertEquals("/tv/gate", DisplaySurfaceRegistry.findByKey("trace-gate")?.routePath)
    }

    @Test
    fun mapsLegacyDepartmentCodes() {
        assertEquals("ready-goods", DisplaySurfaceRegistry.findByLegacyDepartment("RGS")?.key)
    }
}

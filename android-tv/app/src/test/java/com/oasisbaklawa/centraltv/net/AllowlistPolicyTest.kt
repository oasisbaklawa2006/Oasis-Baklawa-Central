package com.oasisbaklawa.centraltv.net

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AllowlistPolicyTest {
    @Test
    fun allowsCentralAndTraceHostsWhenConfigured() {
        val allowed = setOf("app.oasisbaklawacentral.com", "trace.oasisbaklawa.com")
        assertTrue(AllowlistPolicy.isHostAllowed("app.oasisbaklawacentral.com", allowed))
        assertTrue(AllowlistPolicy.isNavigationAllowed("https://app.oasisbaklawacentral.com/tv/rgs"))
        assertTrue(AllowlistPolicy.isNavigationAllowed("https://trace.oasisbaklawa.com/tv/gate"))
    }

    @Test
    fun rejectsNonHttpsNavigation() {
        assertFalse(AllowlistPolicy.isNavigationAllowed("http://app.oasisbaklawacentral.com/tv/rgs"))
    }
}

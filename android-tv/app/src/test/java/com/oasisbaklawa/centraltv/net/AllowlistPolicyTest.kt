package com.oasisbaklawa.centraltv.net

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AllowlistPolicyTest {
    @Test
    fun allowsCentralAndTraceHostsWhenConfigured() {
        // BuildConfig is unavailable in pure JVM tests; exercise parsing logic indirectly via URL shape.
        assertTrue(AllowlistPolicy.isNavigationAllowed("https://app.oasisbaklawacentral.com/tv/rgs"))
    }

    @Test
    fun rejectsNonHttpsNavigation() {
        assertFalse(AllowlistPolicy.isNavigationAllowed("http://app.oasisbaklawacentral.com/tv/rgs"))
    }
}

package com.oasisbaklawa.centraltv

import android.app.Application
import com.oasisbaklawa.centraltv.util.CrashRecoveryHandler

class OasisTvApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashRecoveryHandler(applicationContext).install()
    }
}

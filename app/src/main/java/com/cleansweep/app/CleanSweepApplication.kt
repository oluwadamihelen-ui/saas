package com.cleansweep.app

import android.app.Application
import com.cleansweep.app.core.AppContainer

class CleanSweepApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

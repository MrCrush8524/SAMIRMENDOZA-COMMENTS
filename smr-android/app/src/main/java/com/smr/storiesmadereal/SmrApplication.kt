package com.smr.storiesmadereal

import android.app.Application
import com.smr.storiesmadereal.di.AppContainer

class SmrApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer.get(this)
    }
}

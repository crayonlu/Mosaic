package xyz.cyncyn.mosaic.catalog

import android.app.Application
import xyz.cyncyn.mosaic.catalog.data.AppGraph

class MosaicApp : Application() {

    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
    }
}

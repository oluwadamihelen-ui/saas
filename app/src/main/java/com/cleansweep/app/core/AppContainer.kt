package com.cleansweep.app.core

import android.content.Context
import com.cleansweep.app.data.delete.MediaDeleteHelper
import com.cleansweep.app.data.scanner.AppInventoryScanner
import com.cleansweep.app.data.scanner.DuplicateScanner
import com.cleansweep.app.data.scanner.JunkScanner
import com.cleansweep.app.data.scanner.LargeFileScanner
import com.cleansweep.app.data.scanner.MediaStoreSource

/**
 * Hand-rolled composition root. A Hilt/Dagger graph would be the natural next step once this
 * grows past a handful of screens, but for this scaffold a couple of lazily-built singletons
 * keep the dependency wiring obvious without an annotation-processor build step.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val mediaStoreSource by lazy { MediaStoreSource(appContext) }
    val duplicateScanner by lazy { DuplicateScanner(appContext, mediaStoreSource) }
    val largeFileScanner by lazy { LargeFileScanner(mediaStoreSource) }
    val appInventoryScanner by lazy { AppInventoryScanner(appContext) }
    val junkScanner by lazy { JunkScanner(appContext) }
    val mediaDeleteHelper by lazy { MediaDeleteHelper(appContext) }
}

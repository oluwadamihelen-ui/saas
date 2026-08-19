package com.cleansweep.app.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.cleansweep.app.CleanSweepApplication
import com.cleansweep.app.core.AppContainer

@Composable
fun rememberAppContainer(): AppContainer {
    val context = LocalContext.current
    return (context.applicationContext as CleanSweepApplication).container
}

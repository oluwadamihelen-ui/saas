package com.cleansweep.app.ui.dashboard

import android.os.Environment
import android.os.StatFs
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class StorageOverview(val totalBytes: Long, val freeBytes: Long) {
    val usedBytes: Long get() = totalBytes - freeBytes
    val usedFraction: Float get() = if (totalBytes == 0L) 0f else usedBytes.toFloat() / totalBytes
}

class DashboardViewModel : ViewModel() {
    private val _storageOverview = MutableStateFlow(readStorageOverview())
    val storageOverview: StateFlow<StorageOverview> = _storageOverview

    fun refresh() {
        _storageOverview.value = readStorageOverview()
    }

    private fun readStorageOverview(): StorageOverview {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        val total = stat.blockCountLong * stat.blockSizeLong
        val free = stat.availableBlocksLong * stat.blockSizeLong
        return StorageOverview(totalBytes = total, freeBytes = free)
    }
}

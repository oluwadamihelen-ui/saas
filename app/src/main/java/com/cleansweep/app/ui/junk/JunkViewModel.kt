package com.cleansweep.app.ui.junk

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cleansweep.app.data.scanner.JunkScanner
import com.cleansweep.app.domain.JunkItem
import com.cleansweep.app.domain.ScanState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class JunkViewModel(private val scanner: JunkScanner) : ViewModel() {

    private val _scanState = MutableStateFlow<ScanState<List<JunkItem>>>(ScanState.Idle)
    val scanState: StateFlow<ScanState<List<JunkItem>>> = _scanState

    private val _lastFreedBytes = MutableStateFlow<Long?>(null)
    val lastFreedBytes: StateFlow<Long?> = _lastFreedBytes

    fun scan() {
        viewModelScope.launch {
            _scanState.value = ScanState.Scanning
            runCatching { scanner.scan() }
                .onSuccess { _scanState.value = ScanState.Success(it) }
                .onFailure { _scanState.value = ScanState.Error(it.message ?: "Scan failed") }
        }
    }

    /** Clears CleanSweep's own cache; other items require the user to review them individually. */
    fun clearOwnCache() {
        viewModelScope.launch {
            val freed = withContext(Dispatchers.IO) { scanner.clearOwnAppCache() }
            _lastFreedBytes.value = freed
            scan()
        }
    }

    fun deleteFile(item: JunkItem) {
        viewModelScope.launch {
            val freed = withContext(Dispatchers.IO) {
                val file = File(item.path)
                if (file.delete()) item.sizeBytes else 0L
            }
            _lastFreedBytes.value = (_lastFreedBytes.value ?: 0L) + freed
            scan()
        }
    }
}

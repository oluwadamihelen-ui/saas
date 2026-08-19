package com.cleansweep.app.ui.largefiles

import android.content.IntentSender
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cleansweep.app.data.delete.DeleteOutcome
import com.cleansweep.app.data.delete.MediaDeleteHelper
import com.cleansweep.app.data.scanner.LargeFileScanner
import com.cleansweep.app.domain.LargeFile
import com.cleansweep.app.domain.MediaFile
import com.cleansweep.app.domain.ScanState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class LargeFilesViewModel(
    private val scanner: LargeFileScanner,
    private val deleteHelper: MediaDeleteHelper,
) : ViewModel() {

    private val _scanState = MutableStateFlow<ScanState<List<LargeFile>>>(ScanState.Idle)
    val scanState: StateFlow<ScanState<List<LargeFile>>> = _scanState

    private val _selectedIds = MutableStateFlow<Set<Long>>(emptySet())
    val selectedIds: StateFlow<Set<Long>> = _selectedIds

    private val _pendingConsent = MutableStateFlow<IntentSender?>(null)
    val pendingConsent: StateFlow<IntentSender?> = _pendingConsent

    private val _lastFreedBytes = MutableStateFlow<Long?>(null)
    val lastFreedBytes: StateFlow<Long?> = _lastFreedBytes

    private var pendingDeleteFiles: List<MediaFile> = emptyList()

    fun scan() {
        viewModelScope.launch {
            _scanState.value = ScanState.Scanning
            runCatching { scanner.findLargeFiles() }
                .onSuccess { _scanState.value = ScanState.Success(it) }
                .onFailure { _scanState.value = ScanState.Error(it.message ?: "Scan failed") }
        }
    }

    fun toggleSelected(file: MediaFile) {
        _selectedIds.value = _selectedIds.value.toMutableSet().apply {
            if (!add(file.id)) remove(file.id)
        }
    }

    fun deleteSelected() {
        val results = (_scanState.value as? ScanState.Success)?.result ?: return
        val files = results.map { it.media }.filter { it.id in _selectedIds.value }
        if (files.isEmpty()) return

        viewModelScope.launch {
            when (val outcome = deleteHelper.delete(files)) {
                is DeleteOutcome.Deleted -> {
                    _lastFreedBytes.value = outcome.freedBytes
                    scan()
                }
                is DeleteOutcome.NeedsConsent -> {
                    pendingDeleteFiles = outcome.pendingFiles
                    _pendingConsent.value = outcome.intentSender
                }
            }
        }
    }

    fun onConsentGranted() {
        _pendingConsent.value = null
        _lastFreedBytes.value = pendingDeleteFiles.sumOf { it.sizeBytes }
        pendingDeleteFiles = emptyList()
        scan()
    }

    fun onConsentDenied() {
        _pendingConsent.value = null
        pendingDeleteFiles = emptyList()
    }
}

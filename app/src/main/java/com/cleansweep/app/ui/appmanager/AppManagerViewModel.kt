package com.cleansweep.app.ui.appmanager

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cleansweep.app.data.scanner.AppInventoryScanner
import com.cleansweep.app.domain.AppInfo
import com.cleansweep.app.domain.ScanState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class AppSort { SIZE, LAST_USED }

class AppManagerViewModel(private val scanner: AppInventoryScanner) : ViewModel() {

    private val _scanState = MutableStateFlow<ScanState<List<AppInfo>>>(ScanState.Idle)
    val scanState: StateFlow<ScanState<List<AppInfo>>> = _scanState

    private val _sort = MutableStateFlow(AppSort.SIZE)
    val sort: StateFlow<AppSort> = _sort

    fun load() {
        viewModelScope.launch {
            _scanState.value = ScanState.Scanning
            runCatching { scanner.listInstalledApps() }
                .onSuccess { _scanState.value = ScanState.Success(it) }
                .onFailure { _scanState.value = ScanState.Error(it.message ?: "Couldn't list apps") }
        }
    }

    fun setSort(sort: AppSort) {
        _sort.value = sort
    }

    /** Call after returning from the uninstall confirmation dialog to refresh the list. */
    fun onReturnedFromUninstall() = load()
}

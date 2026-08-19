package com.cleansweep.app.ui.largefiles

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import coil.compose.AsyncImage
import com.cleansweep.app.domain.LargeFile
import com.cleansweep.app.domain.MediaFile
import com.cleansweep.app.domain.ScanState
import com.cleansweep.app.ui.common.EmptyState
import com.cleansweep.app.ui.common.FullScreenLoading
import com.cleansweep.app.ui.common.RequiresMediaPermission
import com.cleansweep.app.ui.common.rememberAppContainer
import com.cleansweep.app.ui.common.toHumanReadableSize

@Composable
fun LargeFilesScreen() {
    RequiresMediaPermission { LargeFilesContent() }
}

@Composable
private fun LargeFilesContent() {
    val container = rememberAppContainer()
    val viewModel: LargeFilesViewModel = viewModel(
        factory = viewModelFactory {
            initializer { LargeFilesViewModel(container.largeFileScanner, container.mediaDeleteHelper) }
        },
    )

    val scanState by viewModel.scanState.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val pendingConsent by viewModel.pendingConsent.collectAsState()
    val freedBytes by viewModel.lastFreedBytes.collectAsState()

    val consentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) viewModel.onConsentGranted() else viewModel.onConsentDenied()
    }

    LaunchedEffect(pendingConsent) {
        pendingConsent?.let { consentLauncher.launch(IntentSenderRequest.Builder(it).build()) }
    }
    LaunchedEffect(Unit) { viewModel.scan() }

    Column(modifier = Modifier.fillMaxSize()) {
        freedBytes?.let {
            Text(
                "Freed ${it.toHumanReadableSize()}",
                modifier = Modifier.padding(16.dp),
                style = MaterialTheme.typography.titleMedium,
            )
        }

        when (val state = scanState) {
            is ScanState.Idle, is ScanState.Scanning -> FullScreenLoading("Scanning for large files…")
            is ScanState.Error -> EmptyState("Couldn't scan: ${state.message}")
            is ScanState.Success -> {
                if (state.result.isEmpty()) {
                    EmptyState("No files over the size threshold were found.")
                } else {
                    LargeFileList(
                        files = state.result,
                        selectedIds = selectedIds,
                        onToggle = viewModel::toggleSelected,
                        onDeleteSelected = viewModel::deleteSelected,
                    )
                }
            }
        }
    }
}

@Composable
private fun LargeFileList(
    files: List<LargeFile>,
    selectedIds: Set<Long>,
    onToggle: (MediaFile) -> Unit,
    onDeleteSelected: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(modifier = Modifier.weight(1f), contentPadding = PaddingValues(16.dp)) {
            items(files, key = { it.media.id }) { item ->
                LargeFileRow(
                    item = item,
                    isSelected = item.media.id in selectedIds,
                    onClick = { onToggle(item.media) },
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("${selectedIds.size} selected")
            Button(onClick = onDeleteSelected, enabled = selectedIds.isNotEmpty()) {
                Text("Delete selected")
            }
        }
    }
}

@Composable
private fun LargeFileRow(item: LargeFile, isSelected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(
            model = item.media.uri,
            contentDescription = item.media.displayName,
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(8.dp)),
        )
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(item.media.displayName, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
            Text(
                "${item.media.sizeBytes.toHumanReadableSize()} · ${item.media.bucketName ?: "Unknown folder"}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Icon(
            if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
        )
    }
}

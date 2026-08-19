package com.cleansweep.app.ui.junk

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import com.cleansweep.app.domain.JunkCategory
import com.cleansweep.app.domain.JunkItem
import com.cleansweep.app.domain.ScanState
import com.cleansweep.app.ui.common.EmptyState
import com.cleansweep.app.ui.common.FullScreenLoading
import com.cleansweep.app.ui.common.RequiresMediaPermission
import com.cleansweep.app.ui.common.rememberAppContainer
import com.cleansweep.app.ui.common.toHumanReadableSize

@Composable
fun JunkScreen() {
    RequiresMediaPermission { JunkContent() }
}

@Composable
private fun JunkContent() {
    val container = rememberAppContainer()
    val viewModel: JunkViewModel = viewModel(
        factory = viewModelFactory { initializer { JunkViewModel(container.junkScanner) } },
    )

    val scanState by viewModel.scanState.collectAsState()
    val freedBytes by viewModel.lastFreedBytes.collectAsState()

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
            is ScanState.Idle, is ScanState.Scanning -> FullScreenLoading("Scanning for junk…")
            is ScanState.Error -> EmptyState("Couldn't scan: ${state.message}")
            is ScanState.Success -> {
                if (state.result.isEmpty()) {
                    EmptyState("Nothing to clean up right now.")
                } else {
                    JunkList(
                        items = state.result,
                        onClearOwnCache = viewModel::clearOwnCache,
                        onDeleteItem = viewModel::deleteFile,
                    )
                }
            }
        }
    }
}

@Composable
private fun JunkList(
    items: List<JunkItem>,
    onClearOwnCache: () -> Unit,
    onDeleteItem: (JunkItem) -> Unit,
) {
    LazyColumn(contentPadding = PaddingValues(16.dp)) {
        items(items) { item ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.label, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                    Text(
                        "${item.category.displayName()} · ${item.sizeBytes.toHumanReadableSize()}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (item.category == JunkCategory.OWN_APP_CACHE) {
                    Button(onClick = onClearOwnCache) { Text("Clear") }
                } else {
                    TextButton(onClick = { onDeleteItem(item) }) { Text("Delete") }
                }
            }
        }
    }
}

private fun JunkCategory.displayName(): String = when (this) {
    JunkCategory.OWN_APP_CACHE -> "App cache"
    JunkCategory.THUMBNAILS -> "Thumbnails"
    JunkCategory.LEFTOVER_INSTALLERS -> "Leftover installer"
    JunkCategory.LOGS_AND_TEMP -> "Log / temp file"
}

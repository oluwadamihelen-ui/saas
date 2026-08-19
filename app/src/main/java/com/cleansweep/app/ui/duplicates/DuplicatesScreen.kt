package com.cleansweep.app.ui.duplicates

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.cleansweep.app.domain.DuplicateGroup
import com.cleansweep.app.domain.MediaFile
import com.cleansweep.app.domain.ScanState
import com.cleansweep.app.ui.common.EmptyState
import com.cleansweep.app.ui.common.FullScreenLoading
import com.cleansweep.app.ui.common.RequiresMediaPermission
import com.cleansweep.app.ui.common.rememberAppContainer
import com.cleansweep.app.ui.common.toHumanReadableSize
import androidx.lifecycle.viewmodel.viewModelFactory

@Composable
fun DuplicatesScreen() {
    RequiresMediaPermission {
        DuplicatesContent()
    }
}

@Composable
private fun DuplicatesContent() {
    val container = rememberAppContainer()
    val viewModel: DuplicatesViewModel = viewModel(
        factory = viewModelFactory {
            initializer { DuplicatesViewModel(container.duplicateScanner, container.mediaDeleteHelper) }
        },
    )

    val scanState by viewModel.scanState.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val pendingConsent by viewModel.pendingConsent.collectAsState()
    val freedBytes by viewModel.lastFreedBytes.collectAsState()

    val consentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            viewModel.onConsentGranted()
        } else {
            viewModel.onConsentDenied()
        }
    }

    LaunchedEffect(pendingConsent) {
        pendingConsent?.let { sender ->
            consentLauncher.launch(IntentSenderRequest.Builder(sender).build())
        }
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
            is ScanState.Idle, is ScanState.Scanning -> FullScreenLoading("Scanning photos & videos…")
            is ScanState.Error -> EmptyState("Couldn't scan: ${state.message}")
            is ScanState.Success -> {
                if (state.result.isEmpty()) {
                    EmptyState("No duplicates found. Your library is clean.")
                } else {
                    DuplicateGroupList(
                        groups = state.result,
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
private fun DuplicateGroupList(
    groups: List<DuplicateGroup>,
    selectedIds: Set<Long>,
    onToggle: (MediaFile) -> Unit,
    onDeleteSelected: () -> Unit,
) {
    val totalWasted = remember(groups) { groups.sumOf { it.wastedBytes } }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            items(groups) { group ->
                DuplicateGroupCard(group = group, selectedIds = selectedIds, onToggle = onToggle)
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Reclaimable: ${totalWasted.toHumanReadableSize()}")
            Button(onClick = onDeleteSelected, enabled = selectedIds.isNotEmpty()) {
                Text("Delete selected (${selectedIds.size})")
            }
        }
    }
}

@Composable
private fun DuplicateGroupCard(
    group: DuplicateGroup,
    selectedIds: Set<Long>,
    onToggle: (MediaFile) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "${group.files.size} copies · ${group.wastedBytes.toHumanReadableSize()} wasted",
                style = MaterialTheme.typography.titleSmall,
            )
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                gridItems(group.files) { file ->
                    ThumbnailTile(
                        file = file,
                        isKeepSuggestion = file.id == group.suggestedKeep.id,
                        isSelected = file.id in selectedIds,
                        onClick = { onToggle(file) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ThumbnailTile(
    file: MediaFile,
    isKeepSuggestion: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick),
    ) {
        AsyncImage(
            model = file.uri,
            contentDescription = file.displayName,
            modifier = Modifier.fillMaxSize(),
        )
        if (isSelected) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)))
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = "Selected for deletion",
                tint = Color.White,
                modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).size(20.dp),
            )
        }
        if (isKeepSuggestion) {
            Text(
                "KEEP",
                color = Color.White,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .background(Color.Black.copy(alpha = 0.5f))
                    .padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}

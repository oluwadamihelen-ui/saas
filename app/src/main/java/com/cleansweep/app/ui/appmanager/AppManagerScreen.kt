package com.cleansweep.app.ui.appmanager

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import com.cleansweep.app.core.PermissionUtils
import com.cleansweep.app.domain.AppInfo
import com.cleansweep.app.domain.ScanState
import com.cleansweep.app.ui.common.EmptyState
import com.cleansweep.app.ui.common.FullScreenLoading
import com.cleansweep.app.ui.common.rememberAppContainer
import com.cleansweep.app.ui.common.toHumanReadableSize
import java.text.DateFormat
import java.util.Date

@Composable
fun AppManagerScreen() {
    val context = LocalContext.current
    val container = rememberAppContainer()
    val viewModel: AppManagerViewModel = viewModel(
        factory = viewModelFactory {
            initializer { AppManagerViewModel(container.appInventoryScanner) }
        },
    )

    val scanState by viewModel.scanState.collectAsState()
    val sort by viewModel.sort.collectAsState()
    var hasUsageAccess by remember { mutableStateOf(PermissionUtils.hasUsageAccess(context)) }

    val uninstallLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { viewModel.onReturnedFromUninstall() }

    val usageAccessLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { hasUsageAccess = PermissionUtils.hasUsageAccess(context) }

    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize()) {
        if (!hasUsageAccess) {
            UsageAccessBanner(onGrant = { usageAccessLauncher.launch(PermissionUtils.usageAccessSettingsIntent()) })
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(selected = sort == AppSort.SIZE, onClick = { viewModel.setSort(AppSort.SIZE) }, label = { Text("By size") })
            FilterChip(
                selected = sort == AppSort.LAST_USED,
                onClick = { viewModel.setSort(AppSort.LAST_USED) },
                label = { Text("By last used") },
                enabled = hasUsageAccess,
            )
        }

        when (val state = scanState) {
            is ScanState.Idle, is ScanState.Scanning -> FullScreenLoading("Reading installed apps…")
            is ScanState.Error -> EmptyState("Couldn't list apps: ${state.message}")
            is ScanState.Success -> {
                val apps = remember(state.result, sort) {
                    when (sort) {
                        AppSort.SIZE -> state.result.sortedByDescending { it.totalSizeBytes }
                        AppSort.LAST_USED -> state.result.sortedBy { it.lastUsedEpochMillis ?: Long.MAX_VALUE }
                    }
                }
                LazyColumn(contentPadding = PaddingValues(16.dp)) {
                    items(apps, key = { it.packageName }) { app ->
                        AppRow(
                            app = app,
                            onUninstall = { uninstallLauncher.launch(PermissionUtils.uninstallIntent(app.packageName)) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageAccessBanner(onGrant: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            "Grant usage access to sort by \"last used\"",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = onGrant) { Text("Grant") }
    }
}

@Composable
private fun AppRow(app: AppInfo, onUninstall: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(app.label, fontWeight = FontWeight.Medium)
            val lastUsed = app.lastUsedEpochMillis?.let {
                "Last used ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(it))}"
            } ?: "Last used: unknown"
            Text(
                "${app.totalSizeBytes.toHumanReadableSize()} · $lastUsed",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Button(onClick = onUninstall) { Text("Uninstall") }
    }
}

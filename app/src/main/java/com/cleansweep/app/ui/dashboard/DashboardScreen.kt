package com.cleansweep.app.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cleansweep.app.ui.common.FeatureCard
import com.cleansweep.app.ui.common.toHumanReadableSize
import com.cleansweep.app.ui.navigation.Destination

@Composable
fun DashboardScreen(
    onNavigate: (Destination) -> Unit,
    viewModel: DashboardViewModel = viewModel(),
) {
    val overview by viewModel.storageOverview.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                Text("Storage", style = MaterialTheme.typography.titleMedium)
                Text(
                    "${overview.usedBytes.toHumanReadableSize()} used of ${overview.totalBytes.toHumanReadableSize()} " +
                        "(${overview.freeBytes.toHumanReadableSize()} free)",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
                )
                LinearProgressIndicator(
                    progress = { overview.usedFraction },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        items(dashboardItems) { item ->
            FeatureCard(
                title = item.destination.label,
                subtitle = item.subtitle,
                icon = item.icon,
                onClick = { onNavigate(item.destination) },
            )
        }
    }
}

private data class DashboardItem(
    val destination: Destination,
    val subtitle: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

private val dashboardItems = listOf(
    DashboardItem(Destination.Duplicates, "Find and remove exact duplicate photos & videos", Icons.Default.Collections),
    DashboardItem(Destination.LargeFiles, "See what's taking up the most space", Icons.Default.Storage),
    DashboardItem(Destination.AppManager, "Uninstall apps you no longer use", Icons.Default.Apps),
    DashboardItem(Destination.Junk, "Clear cache and leftover files", Icons.Default.CleaningServices),
)

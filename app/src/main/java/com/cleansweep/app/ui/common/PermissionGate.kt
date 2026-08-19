package com.cleansweep.app.ui.common

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cleansweep.app.core.PermissionUtils

/**
 * Shows [content] once photo/video read access is granted; otherwise shows a rationale
 * with a button that triggers the system permission dialog. Used by every screen that
 * needs to query MediaStore, so the permission ask happens in-context rather than at launch.
 */
@Composable
fun RequiresMediaPermission(content: @Composable () -> Unit) {
    val context = LocalContext.current
    var granted by remember { mutableStateOf(PermissionUtils.hasMediaAccess(context)) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted = PermissionUtils.hasMediaAccess(context) }

    if (granted) {
        content()
    } else {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "CleanSweep needs access to your photos and videos to find duplicates and " +
                    "large files. Nothing ever leaves your device.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(bottom = 16.dp),
            )
            Button(onClick = { launcher.launch(PermissionUtils.mediaPermissions()) }) {
                Text("Grant access")
            }
        }
    }
}

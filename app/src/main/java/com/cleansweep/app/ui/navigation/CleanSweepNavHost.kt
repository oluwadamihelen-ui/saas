package com.cleansweep.app.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cleansweep.app.ui.appmanager.AppManagerScreen
import com.cleansweep.app.ui.dashboard.DashboardScreen
import com.cleansweep.app.ui.duplicates.DuplicatesScreen
import com.cleansweep.app.ui.junk.JunkScreen
import com.cleansweep.app.ui.largefiles.LargeFilesScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CleanSweepNavHost(navController: NavHostController = rememberNavController()) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val currentDestination = Destination.entries.find { it.route == currentRoute }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(currentDestination?.label ?: "CleanSweep") },
                navigationIcon = {
                    if (currentDestination != Destination.Dashboard) {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(),
            )
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Destination.Dashboard.route,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            composable(Destination.Dashboard.route) {
                DashboardScreen(onNavigate = { navController.navigate(it.route) })
            }
            composable(Destination.Duplicates.route) { DuplicatesScreen() }
            composable(Destination.LargeFiles.route) { LargeFilesScreen() }
            composable(Destination.AppManager.route) { AppManagerScreen() }
            composable(Destination.Junk.route) { JunkScreen() }
        }
    }
}

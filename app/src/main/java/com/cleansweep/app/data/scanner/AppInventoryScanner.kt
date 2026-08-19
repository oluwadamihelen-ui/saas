package com.cleansweep.app.data.scanner

import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import android.os.storage.StorageManager
import com.cleansweep.app.domain.AppInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar

/**
 * Lists installed apps with size + last-used info.
 *
 * Sizes require [android.Manifest.permission.PACKAGE_USAGE_STATS], a "special app access"
 * the user grants via Settings, not a runtime permission dialog — see PermissionUtils.
 * When it isn't granted yet, sizes/last-used come back null and the UI shows the app list
 * without that column rather than failing the whole screen.
 */
class AppInventoryScanner(private val context: Context) {

    suspend fun listInstalledApps(includeSystemApps: Boolean = false): List<AppInfo> =
        withContext(Dispatchers.IO) {
            val pm = context.packageManager
            val lastUsedByPackage = runCatching { queryLastUsedTimestamps() }.getOrDefault(emptyMap())

            pm.getInstalledApplications(PackageManager.GET_META_DATA)
                .asSequence()
                .filter { it.packageName != context.packageName }
                .filter { includeSystemApps || !it.isSystemApp() }
                .map { appInfo ->
                    val sizes = runCatching { queryStorageStats(appInfo.packageName) }.getOrNull()
                    val packageInfo = runCatching { pm.getPackageInfo(appInfo.packageName, 0) }.getOrNull()
                    AppInfo(
                        packageName = appInfo.packageName,
                        label = pm.getApplicationLabel(appInfo).toString(),
                        apkSizeBytes = sizes?.appBytes ?: 0L,
                        dataSizeBytes = sizes?.dataBytes ?: 0L,
                        cacheSizeBytes = sizes?.cacheBytes ?: 0L,
                        isSystemApp = appInfo.isSystemApp(),
                        lastUsedEpochMillis = lastUsedByPackage[appInfo.packageName],
                        installedEpochMillis = packageInfo?.firstInstallTime ?: 0L,
                    )
                }
                .sortedByDescending { it.totalSizeBytes }
                .toList()
        }

    private fun ApplicationInfo.isSystemApp(): Boolean =
        (flags and ApplicationInfo.FLAG_SYSTEM) != 0

    private fun queryStorageStats(packageName: String): StorageStatsManager.StorageStats {
        val statsManager = context.getSystemService(Context.STORAGE_STATS_SERVICE) as StorageStatsManager
        return statsManager.queryStatsForPackage(
            StorageManager.UUID_DEFAULT,
            packageName,
            Process.myUserHandle(),
        )
    }

    private fun queryLastUsedTimestamps(): Map<String, Long> {
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val start = Calendar.getInstance().apply {
            timeInMillis = end
            add(Calendar.YEAR, -1)
        }.timeInMillis

        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_YEARLY, start, end)
        return stats
            .filter { it.lastTimeUsed > 0 }
            .associate { it.packageName to it.lastTimeUsed }
    }
}

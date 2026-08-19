package com.cleansweep.app.data.scanner

import android.content.Context
import android.os.Environment
import com.cleansweep.app.domain.JunkCategory
import com.cleansweep.app.domain.JunkItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Finds reclaimable space this app can actually access.
 *
 * Since Android 8, apps cannot read another app's private cache directory, and there is no
 * API to enumerate it — so unlike the marketing claims of some cleaner apps, this cannot
 * report "other apps' cache" as a number. What it *can* do, honestly:
 *  - clear CleanSweep's own cache,
 *  - find leftover installer APKs and stray temp/log files sitting in shared storage
 *    (e.g. Downloads) that the user can review and delete themselves.
 */
class JunkScanner(private val context: Context) {

    private val leftoverExtensions = setOf("apk", "tmp", "log", "log1", "log2", "bak")

    suspend fun scan(): List<JunkItem> = withContext(Dispatchers.IO) {
        buildList {
            add(ownAppCacheItem())
            addAll(scanSharedFolder(Environment.DIRECTORY_DOWNLOADS))
        }
    }

    private fun ownAppCacheItem(): JunkItem {
        val size = (context.cacheDir?.sizeRecursively() ?: 0L) +
            (context.externalCacheDir?.sizeRecursively() ?: 0L)
        return JunkItem(
            category = JunkCategory.OWN_APP_CACHE,
            label = "CleanSweep cache",
            sizeBytes = size,
            path = context.cacheDir?.absolutePath.orEmpty(),
        )
    }

    fun clearOwnAppCache(): Long {
        val freed = (context.cacheDir?.sizeRecursively() ?: 0L) +
            (context.externalCacheDir?.sizeRecursively() ?: 0L)
        context.cacheDir?.deleteRecursivelyKeepingRoot()
        context.externalCacheDir?.deleteRecursivelyKeepingRoot()
        return freed
    }

    private fun scanSharedFolder(directoryType: String): List<JunkItem> {
        val dir = Environment.getExternalStoragePublicDirectory(directoryType) ?: return emptyList()
        val files = dir.listFiles() ?: return emptyList()

        return files
            .filter { it.isFile && it.extension.lowercase() in leftoverExtensions }
            .map {
                val category = if (it.extension.equals("apk", ignoreCase = true)) {
                    JunkCategory.LEFTOVER_INSTALLERS
                } else {
                    JunkCategory.LOGS_AND_TEMP
                }
                JunkItem(category = category, label = it.name, sizeBytes = it.length(), path = it.absolutePath)
            }
    }

    private fun File.sizeRecursively(): Long =
        if (isFile) length() else (listFiles()?.sumOf { it.sizeRecursively() } ?: 0L)

    private fun File.deleteRecursivelyKeepingRoot() {
        listFiles()?.forEach { it.deleteRecursively() }
    }
}

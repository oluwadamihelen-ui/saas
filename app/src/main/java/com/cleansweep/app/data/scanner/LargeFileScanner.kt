package com.cleansweep.app.data.scanner

import com.cleansweep.app.domain.LargeFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LargeFileScanner(private val mediaStoreSource: MediaStoreSource) {

    companion object {
        const val DEFAULT_THRESHOLD_BYTES = 20L * 1024 * 1024 // 20 MB
    }

    suspend fun findLargeFiles(
        thresholdBytes: Long = DEFAULT_THRESHOLD_BYTES,
    ): List<LargeFile> = withContext(Dispatchers.IO) {
        mediaStoreSource.queryImagesAndVideos()
            .filter { it.sizeBytes >= thresholdBytes }
            .sortedByDescending { it.sizeBytes }
            .map {
                // MediaStore doesn't expose a reliable "last opened" timestamp for media
                // files, so date-added is used as the closest available proxy — surfaced
                // in the UI as "added" rather than "last used" to stay honest about it.
                LargeFile(media = it, lastUsedEpochSeconds = it.dateAddedEpochSeconds)
            }
    }
}

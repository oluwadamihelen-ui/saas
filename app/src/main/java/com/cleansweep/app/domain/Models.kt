package com.cleansweep.app.domain

import android.net.Uri

/** A single media file (image or video) found via MediaStore. */
data class MediaFile(
    val id: Long,
    val uri: Uri,
    val displayName: String,
    val sizeBytes: Long,
    val dateAddedEpochSeconds: Long,
    val bucketName: String?,
    val mimeType: String?,
)

/** A group of files that hash-identical (exact duplicates). One is suggested to keep. */
data class DuplicateGroup(
    val contentHash: String,
    val files: List<MediaFile>,
) {
    val wastedBytes: Long
        get() = files.drop(1).sumOf { it.sizeBytes }

    /** Newest file is kept by default; the rest are pre-selected for deletion. */
    val suggestedKeep: MediaFile
        get() = files.maxBy { it.dateAddedEpochSeconds }

    val suggestedDelete: List<MediaFile>
        get() = files.filterNot { it.id == suggestedKeep.id }
}

data class LargeFile(
    val media: MediaFile,
    val lastUsedEpochSeconds: Long?,
)

data class AppInfo(
    val packageName: String,
    val label: String,
    val apkSizeBytes: Long,
    val dataSizeBytes: Long,
    val cacheSizeBytes: Long,
    val isSystemApp: Boolean,
    val lastUsedEpochMillis: Long?,
    val installedEpochMillis: Long,
) {
    val totalSizeBytes: Long get() = apkSizeBytes + dataSizeBytes + cacheSizeBytes
}

enum class JunkCategory { OWN_APP_CACHE, THUMBNAILS, LEFTOVER_INSTALLERS, LOGS_AND_TEMP }

data class JunkItem(
    val category: JunkCategory,
    val label: String,
    val sizeBytes: Long,
    val path: String,
)

/** Generic scan lifecycle used by every feature ViewModel. */
sealed interface ScanState<out T> {
    data object Idle : ScanState<Nothing>
    data object Scanning : ScanState<Nothing>
    data class Success<T>(val result: T) : ScanState<T>
    data class Error(val message: String) : ScanState<Nothing>
}

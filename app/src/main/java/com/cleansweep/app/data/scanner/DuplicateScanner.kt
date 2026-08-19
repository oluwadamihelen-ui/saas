package com.cleansweep.app.data.scanner

import android.content.Context
import com.cleansweep.app.domain.DuplicateGroup
import com.cleansweep.app.domain.MediaFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest

/**
 * Finds exact-duplicate photos/videos.
 *
 * Strategy: group by file size first (free — already in MediaStore), since two files with
 * different sizes can never be byte-identical. Only files that share a size with at least one
 * other file get hashed, which keeps this fast even on libraries with tens of thousands of
 * items instead of hashing everything up front.
 */
class DuplicateScanner(
    private val context: Context,
    private val mediaStoreSource: MediaStoreSource,
) {

    suspend fun findExactDuplicates(): List<DuplicateGroup> = withContext(Dispatchers.IO) {
        val allMedia = mediaStoreSource.queryImagesAndVideos()
        val bySize = allMedia.filter { it.sizeBytes > 0 }.groupBy { it.sizeBytes }

        val candidates = bySize.values.filter { it.size > 1 }.flatten()

        candidates
            .groupBy { hashOf(it) }
            .filterKeys { it != null }
            .filterValues { it.size > 1 }
            .map { (hash, files) -> DuplicateGroup(contentHash = hash!!, files = files) }
            .sortedByDescending { it.wastedBytes }
    }

    private fun hashOf(file: MediaFile): String? = runCatching {
        val digest = MessageDigest.getInstance("MD5")
        context.contentResolver.openInputStream(file.uri)?.use { input ->
            val buffer = ByteArray(8 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        digest.digest().joinToString("") { "%02x".format(it) }
    }.getOrNull()
}

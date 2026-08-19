package com.cleansweep.app.data.scanner

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import com.cleansweep.app.domain.MediaFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Reads photo + video metadata from MediaStore. This is the one collection every other
 * scanner (duplicates, large files) is built on top of, so it stays a single query site.
 */
class MediaStoreSource(private val context: Context) {

    suspend fun queryImagesAndVideos(): List<MediaFile> = withContext(Dispatchers.IO) {
        buildList {
            addAll(query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI))
            addAll(query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI))
        }
    }

    private fun query(collection: android.net.Uri): List<MediaFile> {
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_ADDED,
            MediaStore.MediaColumns.BUCKET_DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
        )
        val results = mutableListOf<MediaFile>()
        context.contentResolver.query(collection, projection, null, null, null)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
            val bucketCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                results += MediaFile(
                    id = id,
                    uri = ContentUris.withAppendedId(collection, id),
                    displayName = cursor.getString(nameCol) ?: "unknown",
                    sizeBytes = cursor.getLong(sizeCol),
                    dateAddedEpochSeconds = cursor.getLong(dateCol),
                    bucketName = cursor.getString(bucketCol),
                    mimeType = cursor.getString(mimeCol),
                )
            }
        }
        return results
    }
}

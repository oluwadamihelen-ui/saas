package com.cleansweep.app.data.delete

import android.app.RecoverableSecurityException
import android.content.Context
import android.content.IntentSender
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.cleansweep.app.domain.MediaFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Deletes MediaStore items, respecting each API level's consent rules. Files are never
 * deleted silently in the background — this always runs from an explicit user action on a
 * review screen, and on API 29+ the OS itself puts up a confirmation dialog for anything the
 * app doesn't own.
 */
sealed interface DeleteOutcome {
    data class Deleted(val freedBytes: Long) : DeleteOutcome
    /** Caller must launch this with ActivityResultContracts.StartIntentSenderForResult. */
    data class NeedsConsent(val intentSender: IntentSender, val pendingFiles: List<MediaFile>) : DeleteOutcome
}

class MediaDeleteHelper(private val context: Context) {

    suspend fun delete(files: List<MediaFile>): DeleteOutcome = withContext(Dispatchers.IO) {
        if (files.isEmpty()) return@withContext DeleteOutcome.Deleted(0)

        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> requestBatchDelete(files)
            Build.VERSION.SDK_INT == Build.VERSION_CODES.Q -> deleteOneByOneQ(files)
            else -> deleteLegacy(files)
        }
    }

    /** API 30+: one system dialog covers the whole batch, owned or not. */
    private fun requestBatchDelete(files: List<MediaFile>): DeleteOutcome {
        val uris: List<Uri> = files.map { it.uri }
        val pendingIntent = MediaStore.createDeleteRequest(context.contentResolver, uris)
        return DeleteOutcome.NeedsConsent(pendingIntent.intentSender, files)
    }

    /** API 29: no batch API — delete what's owned, surface the first unowned item for consent. */
    private fun deleteOneByOneQ(files: List<MediaFile>): DeleteOutcome {
        var freed = 0L
        val remaining = files.toMutableList()
        while (remaining.isNotEmpty()) {
            val file = remaining.removeAt(0)
            try {
                val rows = context.contentResolver.delete(file.uri, null, null)
                if (rows > 0) freed += file.sizeBytes
            } catch (e: RecoverableSecurityException) {
                return DeleteOutcome.NeedsConsent(
                    e.userAction.actionIntent.intentSender,
                    listOf(file) + remaining,
                )
            }
        }
        return DeleteOutcome.Deleted(freed)
    }

    /** API 26-28: legacy storage, direct delete once WRITE_EXTERNAL_STORAGE is granted. */
    private fun deleteLegacy(files: List<MediaFile>): DeleteOutcome {
        var freed = 0L
        for (file in files) {
            val rows = runCatching { context.contentResolver.delete(file.uri, null, null) }.getOrDefault(0)
            if (rows > 0) freed += file.sizeBytes
        }
        return DeleteOutcome.Deleted(freed)
    }
}

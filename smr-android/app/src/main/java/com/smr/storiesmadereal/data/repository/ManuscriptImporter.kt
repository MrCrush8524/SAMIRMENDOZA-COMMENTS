package com.smr.storiesmadereal.data.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.smr.storiesmadereal.data.model.Manuscript
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * Copies an imported document into the app's private storage as plain text and registers a
 * [Manuscript] row. V1 supports plain-text manuscripts end to end; PDF/DOCX extraction is a
 * separate, still-unwired parser step (see project README) that would plug in here, upstream
 * of [importPlainText].
 */
class ManuscriptImporter(private val context: Context) {

    private val manuscriptsDir: File
        get() = File(context.filesDir, "manuscripts").apply { mkdirs() }

    suspend fun importPlainText(uri: Uri): Manuscript = withContext(Dispatchers.IO) {
        val displayName = queryDisplayName(uri) ?: "Untitled manuscript"
        val id = UUID.randomUUID().toString()
        val destination = File(manuscriptsDir, "$id.txt")

        context.contentResolver.openInputStream(uri)?.use { input ->
            destination.outputStream().use { output -> input.copyTo(output) }
        } ?: error("Unable to open manuscript at $uri")

        val text = destination.readText()
        val wordCount = text.trim().split(Regex("\\s+")).size

        Manuscript(
            id = id,
            title = displayName.substringBeforeLast('.'),
            sourceFileName = displayName,
            textFilePath = destination.absolutePath,
            importedAtEpochMs = System.currentTimeMillis(),
            wordCount = wordCount,
            // Rough narration estimate at ~150 words/minute for the standard voice.
            durationEstimateSeconds = (wordCount / 150.0 * 60).toLong()
        )
    }

    private fun queryDisplayName(uri: Uri): String? {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) return cursor.getString(nameIndex)
        }
        return uri.lastPathSegment
    }
}

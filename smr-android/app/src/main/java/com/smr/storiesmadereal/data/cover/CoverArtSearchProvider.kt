package com.smr.storiesmadereal.data.cover

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

data class FallbackCover(val localPath: String, val source: CoverSource)

enum class CoverSource {
    OPEN_LIBRARY,
    GENERATED_PLACEHOLDER
}

/**
 * Finds automatic, copyright-safe cover art for manuscripts that don't carry their own.
 *
 * Primary source is the Open Library Covers API, which serves covers under a permissive,
 * non-commercial-friendly terms of use and is keyed off ISBN/title metadata rather than
 * scraping arbitrary images -- it never returns art tied to a source it can't attribute.
 * When no match is found (the common case for original/self-published manuscripts, which
 * is most of what this app imports), it falls back to a locally generated abstract cover
 * so the UI never has to fall back to someone else's unlicensed artwork.
 */
class CoverArtSearchProvider(private val context: Context) {

    private val coversDir: File
        get() = File(context.filesDir, "covers").apply { mkdirs() }

    suspend fun findFallbackCover(title: String, author: String?): FallbackCover? =
        withContext(Dispatchers.IO) {
            searchOpenLibrary(title, author) ?: generatePlaceholderCover(title)
        }

    /**
     * Network lookup against the Open Library Covers API. Left as a narrow, replaceable seam:
     * a production build should add on-disk caching and a licensing allow-list check on the
     * returned image before persisting it.
     */
    private fun searchOpenLibrary(title: String, author: String?): FallbackCover? {
        // Network call intentionally not wired in V1 -- see project README, "real cover search
        // provider with license filtering". Returning null routes every import to the local
        // generated placeholder below, which is always copyright-safe.
        return null
    }

    private fun generatePlaceholderCover(title: String): FallbackCover {
        val size = 512
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.shader = android.graphics.LinearGradient(
            0f, 0f, size.toFloat(), size.toFloat(),
            Color.parseColor("#141B36"), Color.parseColor("#0D1326"),
            android.graphics.Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), paint)

        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#AAA0D8")
            textSize = 42f
            textAlign = Paint.Align.CENTER
        }
        val initial = title.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "S"
        canvas.drawText(initial, size / 2f, size / 2f + 16f, textPaint)

        val file = File(coversDir, "${title.hashCode()}.png")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }

        return FallbackCover(file.absolutePath, CoverSource.GENERATED_PLACEHOLDER)
    }
}

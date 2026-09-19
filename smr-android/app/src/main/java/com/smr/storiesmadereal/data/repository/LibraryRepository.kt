package com.smr.storiesmadereal.data.repository

import android.content.Context
import android.net.Uri
import com.smr.storiesmadereal.data.cover.CoverArtSearchProvider
import com.smr.storiesmadereal.data.model.Manuscript
import kotlinx.coroutines.flow.Flow

/** Single source of truth for the local manuscript library. */
class LibraryRepository(
    context: Context,
    private val coverArtSearchProvider: CoverArtSearchProvider = CoverArtSearchProvider(context)
) {
    private val dao = SmrDatabase.get(context).manuscriptDao()
    private val importer = ManuscriptImporter(context)

    fun observeLibrary(): Flow<List<Manuscript>> = dao.observeAll()

    suspend fun getManuscript(id: String): Manuscript? = dao.getById(id)

    suspend fun importManuscript(uri: Uri): Manuscript {
        val manuscript = importer.importPlainText(uri)
        dao.upsert(manuscript)

        // Automatic copyright-safe fallback cover: only runs if the import didn't
        // already carry embedded artwork (plain-text imports never do).
        val fallbackCover = coverArtSearchProvider.findFallbackCover(manuscript.title, manuscript.author)
        val withCover = if (fallbackCover != null) {
            manuscript.copy(coverArtPath = fallbackCover.localPath, coverArtIsFallback = true)
        } else {
            manuscript
        }
        if (withCover !== manuscript) dao.upsert(withCover)
        return withCover
    }

    suspend fun deleteManuscript(manuscript: Manuscript) = dao.delete(manuscript)

    suspend fun updateManuscript(manuscript: Manuscript) = dao.update(manuscript)
}

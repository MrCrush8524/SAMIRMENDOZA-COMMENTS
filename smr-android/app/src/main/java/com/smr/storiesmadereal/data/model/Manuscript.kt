package com.smr.storiesmadereal.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * A single imported manuscript. [textFilePath] points at the plain-text extraction on local
 * storage -- the private manuscript body itself never leaves the device except as short
 * excerpts sent to Claude for Retell/Summary/Podcast generation (see ClaudeRepository).
 */
@Entity(tableName = "manuscripts")
data class Manuscript(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val author: String? = null,
    val sourceFileName: String,
    val textFilePath: String,
    val coverArtPath: String? = null,
    val coverArtIsFallback: Boolean = false,
    val importedAtEpochMs: Long,
    val durationEstimateSeconds: Long = 0L,
    val wordCount: Int = 0
)

package com.smr.storiesmadereal.data.repository

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.smr.storiesmadereal.data.model.Manuscript
import kotlinx.coroutines.flow.Flow

@Dao
interface ManuscriptDao {
    @Query("SELECT * FROM manuscripts ORDER BY importedAtEpochMs DESC")
    fun observeAll(): Flow<List<Manuscript>>

    @Query("SELECT * FROM manuscripts WHERE id = :id")
    suspend fun getById(id: String): Manuscript?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(manuscript: Manuscript)

    @Update
    suspend fun update(manuscript: Manuscript)

    @Delete
    suspend fun delete(manuscript: Manuscript)
}

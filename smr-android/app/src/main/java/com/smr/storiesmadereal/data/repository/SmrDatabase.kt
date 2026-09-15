package com.smr.storiesmadereal.data.repository

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.smr.storiesmadereal.data.model.Manuscript

@Database(entities = [Manuscript::class], version = 1, exportSchema = false)
abstract class SmrDatabase : RoomDatabase() {
    abstract fun manuscriptDao(): ManuscriptDao

    companion object {
        @Volatile private var instance: SmrDatabase? = null

        fun get(context: Context): SmrDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    SmrDatabase::class.java,
                    "smr.db"
                ).build().also { instance = it }
            }
    }
}

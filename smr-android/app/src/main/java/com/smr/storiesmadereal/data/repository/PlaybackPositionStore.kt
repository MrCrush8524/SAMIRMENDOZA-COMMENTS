package com.smr.storiesmadereal.data.repository

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "smr_playback_prefs")

/** Persists the last-played manuscript and per-manuscript resume position across app restarts. */
class PlaybackPositionStore(private val context: Context) {

    private fun positionKey(manuscriptId: String) = longPreferencesKey("position_$manuscriptId")
    private fun modeKey(manuscriptId: String) = stringPreferencesKey("mode_$manuscriptId")
    private val lastOpenedKey = stringPreferencesKey("last_opened_manuscript_id")

    suspend fun savePosition(manuscriptId: String, positionMs: Long) {
        // The lambda parameter must infer as MutablePreferences (not the read-only
        // Preferences supertype) -- only MutablePreferences defines the set operator used below.
        context.dataStore.edit { prefs ->
            prefs[positionKey(manuscriptId)] = positionMs
            prefs[lastOpenedKey] = manuscriptId
        }
    }

    suspend fun saveMode(manuscriptId: String, modeName: String) {
        context.dataStore.edit { prefs -> prefs[modeKey(manuscriptId)] = modeName }
    }

    fun observePosition(manuscriptId: String): Flow<Long> =
        context.dataStore.data.map { it[positionKey(manuscriptId)] ?: 0L }

    fun observeLastOpenedManuscriptId(): Flow<String?> =
        context.dataStore.data.map { it[lastOpenedKey] }
}

package com.smr.storiesmadereal.data.claude

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Thin client for the Claude Messages API. This is the one module in the app that talks to a
 * cloud model, and it is used *only* for Retell/Summary/Podcast script generation -- Read mode
 * narrates the manuscript verbatim through the local TTS engine and never calls this class.
 *
 * The API key currently comes from BuildConfig for local/dev builds (see app/build.gradle.kts
 * and gradle.properties). Shipping this to real users means moving key custody behind a
 * backend proxy so the key never sits in an installed APK -- see project README, "encrypted
 * key storage / backend proxy for Claude key". That swap only touches [sendMessage] below.
 */
class ClaudeApiClient(
    private val apiKey: String,
    private val model: String = "claude-sonnet-4-5",
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val endpoint = "https://api.anthropic.com/v1/messages"

    suspend fun sendMessage(
        systemPrompt: String,
        userPrompt: String,
        maxTokens: Int = 4096
    ): Result<String> = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) {
            return@withContext Result.failure(IllegalStateException("Claude API key not configured"))
        }

        val requestBody = ClaudeMessageRequest(
            model = model,
            maxTokens = maxTokens,
            system = systemPrompt,
            messages = listOf(ClaudeMessage(role = "user", content = userPrompt))
        )

        val request = Request.Builder()
            .url(endpoint)
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .addHeader("content-type", "application/json")
            .post(json.encodeToString(ClaudeMessageRequest.serializer(), requestBody)
                .toRequestBody("application/json".toMediaType()))
            .build()

        runCatching {
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val error = runCatching {
                        json.decodeFromString(ClaudeErrorResponse.serializer(), bodyText)
                    }.getOrNull()
                    error(error?.error?.message ?: "Claude API error ${response.code}")
                }
                val parsed = json.decodeFromString(ClaudeMessageResponse.serializer(), bodyText)
                parsed.content.joinToString("\n") { it.text }
            }
        }
    }
}

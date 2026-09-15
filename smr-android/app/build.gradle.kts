plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// --- sherpa-onnx native libraries ---------------------------------------------------------
//
// k2-fsa/sherpa-onnx doesn't publish an Android Maven artifact (confirmed: nothing exists
// under the com.k2fsa group on Maven Central, and the one third-party Maven mirror that does
// exist -- com.bihe0832.android:lib-sherpa-onnx -- turns out to be ASR/KWS-only across every
// published version, with no TTS classes at all). The real, upstream-sanctioned pattern is to
// compile the Kotlin API source directly into the app (com/k2fsa/sherpa/onnx/Tts.kt, vendored
// verbatim below) and pair it with prebuilt native .so libraries from a GitHub release. This
// task downloads and unpacks those libraries at build time instead of committing ~40MB of
// binaries to the repo, and is a no-op once already fetched.
val sherpaOnnxVersion = "1.12.14"
val sherpaOnnxJniLibsDir = layout.buildDirectory.dir("sherpaOnnxJniLibs")

val fetchSherpaOnnxNativeLibs by tasks.registering {
    val outputDir = sherpaOnnxJniLibsDir.get().asFile
    val markerFile = File(outputDir, ".fetched-$sherpaOnnxVersion")
    outputs.dir(outputDir)
    onlyIf { !markerFile.exists() }

    doLast {
        outputDir.mkdirs()
        val archiveUrl =
            "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$sherpaOnnxVersion/" +
                "sherpa-onnx-v$sherpaOnnxVersion-android.tar.bz2"
        val archiveFile = File(temporaryDir, "sherpa-onnx-android.tar.bz2")

        ant.withGroovyBuilder {
            "get"("src" to archiveUrl, "dest" to archiveFile, "skipexisting" to false)
        }

        copy {
            from(tarTree(resources.bzip2(archiveFile)))
            into(outputDir)
            include("jniLibs/**")
            eachFile { path = path.removePrefix("jniLibs/") }
            includeEmptyDirs = false
        }

        markerFile.writeText("fetched")
    }
}

// --- Kokoro narration model, bundled into the APK at build time --------------------------
//
// The user wants the built APK to already contain the narration model -- fetch it from GitHub
// once via `git fetch`/download the APK artifact, never see a separate in-app download step.
// The model itself (~320MB) can't be committed to this repo (GitHub hard-blocks pushes over
// 100MB without Git LFS), so it's fetched here during the CI build, exactly like the native
// .so libraries above, and packaged as a raw Android asset. At runtime, KokoroTtsEngine copies
// it from the bundled asset into local storage once (fast local I/O, no network) instead of
// downloading it -- see that class for why file-based loading is used instead of loading
// straight from AssetManager (the native binding's asset-loading support for a whole
// directory tree like espeak-ng-data/ isn't something this project has verified).
val kokoroModelAssetsDir = layout.buildDirectory.dir("kokoroModelAssets")

val fetchKokoroModelAsset by tasks.registering {
    val outputDir = kokoroModelAssetsDir.get().asFile
    val markerFile = File(outputDir, ".fetched")
    outputs.dir(outputDir)
    onlyIf { !markerFile.exists() }

    doLast {
        val assetDir = File(outputDir, "assets/kokoro_model")
        assetDir.mkdirs()
        val archiveUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2"
        val archiveFile = File(temporaryDir, "kokoro-en-v0_19.tar.bz2")

        ant.withGroovyBuilder {
            "get"("src" to archiveUrl, "dest" to archiveFile, "skipexisting" to false)
        }

        copy {
            from(tarTree(resources.bzip2(archiveFile)))
            into(assetDir)
            // The archive extracts to a single top-level "kokoro-en-v0_19/" folder; strip it so
            // model.onnx, voices.bin, tokens.txt, espeak-ng-data/ land directly in the asset dir.
            eachFile { path = path.substringAfter('/') }
            includeEmptyDirs = false
        }

        markerFile.writeText("fetched")
    }
}

android {
    namespace = "com.smr.storiesmadereal"
    // Target device: Samsung Galaxy A71 5G (SM-A716U), Android 13 (API 33)
    compileSdk = 34

    defaultConfig {
        applicationId = "com.smr.storiesmadereal"
        minSdk = 26
        targetSdk = 33
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField(
            "String",
            "CLAUDE_API_KEY",
            "\"${project.findProperty("SMR_CLAUDE_API_KEY") ?: ""}\""
        )
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        // TopAppBar and a few other Material 3 components used across the screens are marked
        // @ExperimentalMaterial3Api; opted in globally rather than annotating every call site.
        freeCompilerArgs += listOf("-opt-in=androidx.compose.material3.ExperimentalMaterial3Api")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    androidResources {
        // The bundled model files are already dense binary data (ONNX weights) -- forcing APK
        // zip compression on them wastes real build/install time for negligible size savings,
        // and keeps them directly mmap-able from the APK instead of needing decompression.
        noCompress += listOf("onnx", "bin", "dict")
    }

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs(sherpaOnnxJniLibsDir)
            assets.srcDirs(kokoroModelAssetsDir.map { it.dir("assets") })
        }
    }
}

tasks.named("preBuild") {
    dependsOn(fetchSherpaOnnxNativeLibs, fetchKokoroModelAsset)
}

dependencies {
    // Core / lifecycle
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Media3 (foreground playback service, lock-screen controls, audio focus)
    implementation("androidx.media3:media3-exoplayer:1.4.0")
    implementation("androidx.media3:media3-session:1.4.0")
    implementation("androidx.media3:media3-common:1.4.0")

    // Networking (Claude API)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // sherpa-onnx: no Maven dependency needed here. The Kotlin API is vendored as source at
    // com/k2fsa/sherpa/onnx/Tts.kt, and its native .so libraries are fetched by the
    // fetchSherpaOnnxNativeLibs task above (see that comment for why). See tts/TtsEngine.kt
    // and voiceclone/VoiceCloneEngine.kt for how this app isolates the engine behind
    // replaceable interfaces. The Kokoro model itself is bundled as an asset by
    // fetchKokoroModelAsset and copied from there at runtime (KokoroModelManager) --
    // no tar.bz2 extraction happens on-device anymore, so commons-compress isn't needed here.

    // Local persistence
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}

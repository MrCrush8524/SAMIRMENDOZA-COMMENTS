plugins {
    id("com.android.application") version "8.5.2" apply false
    // The org.jetbrains.kotlin.plugin.compose plugin (Compose compiler as a standalone Gradle
    // plugin) only exists for Kotlin 2.0+; that's what CI failed to resolve on 1.9.24.
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.28" apply false
}

tasks.register("clean", Delete::class) {
    delete(rootProject.buildDir)
}

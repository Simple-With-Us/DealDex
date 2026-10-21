plugins {
    // 8.6 is the first AGP validated against compileSdk 35, which this module
    // now targets. It requires Gradle 8.7, which is what the wrapper pins.
    id("com.android.application") version "9.4.1" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
    id("io.sentry.android.gradle") version "6.24.0" apply false
}

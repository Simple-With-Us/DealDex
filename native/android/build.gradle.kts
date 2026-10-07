plugins {
    // 8.6 is the first AGP validated against compileSdk 35, which this module
    // now targets. It requires Gradle 8.7, which is what the wrapper pins.
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.25" apply false
}
